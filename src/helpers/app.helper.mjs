import * as http from 'http'
import { RegExpIOCHelper } from './regexpioc.helper.mjs'
import { LoggerHelper } from './logger.helper.mjs'
import { MetricHelper } from './metric.helper.mjs'

async function listener(request, response) {

    request.logger = RegExpIOCHelper.register(LoggerHelper)

    try {

        request.url = new URL(request.url, `http://${request.headers.host}`)

        request.logger.log('call', request.url.pathname)
        MetricHelper.http_received_request_total.inc()
        MetricHelper.http_received_request_total.inc({ path: request.url.pathname })

        const controller = RegExpIOCHelper.inject(request.url.pathname)

        if (!controller) {
            const controller = RegExpIOCHelper.inject('404')
            await controller.handle(request, response)
            return
        }

        if (Array.isArray(controller)) {
            const controllers = controller.map(({ [RegExpIOCHelper.type]: name }) => name)
            request.logger.error('there are more than one controller found:', controllers)
            response.statusCode = 500
            response.end()
            return
        }

        const handler = controller[request.method.toLocaleLowerCase()] ?? controller.handle

        if (!controller) {
            const controller = RegExpIOCHelper.inject('404')
            await controller.handle(request, response)
            return
        }

        await handler(request, response)

    } catch (error) {
        response.statusCode = 500
        response.end()
        request.logger.error('error:', error)
    } finally {
        MetricHelper.http_received_request_total.inc({ status: response.statusCode })
        MetricHelper.http_received_request_total.inc({ path: request.url.pathname, status: response.statusCode })
        RegExpIOCHelper.unregister(request.logger)
    }

}

function exit(shutdown) {
    return async () => {
        if (shutdown) {
            await shutdown()
        }
        process.exit(0)
    }
}

export class AppHelper {

    static async create({ shutdown } = {}) {

        process.on('SIGILL', exit(shutdown))
        process.on('SIGTERM', exit(shutdown))
        process.on('SIGINT', exit(shutdown))

        return http.createServer(listener)

    }
}