import { IncomingMessage, Server, ServerResponse, createServer } from 'http'
import { NotFoundController } from '../controllers/default/notfound.controller.js'
import { ApplicationHelper } from '../helpers/application.helper.js'
import { AuthHelper } from '../helpers/auth.helper.js'
import { ControllerHelper } from '../helpers/controller.helper.js'
import { HTTPHelper } from '../helpers/http.helper.js'
import { MetricHelper } from '../helpers/metric.helper.js'
import { ObjectHelper } from '../helpers/object.helper.js'
import { TransactionalContext } from './context.js'
import { Regex, RegexField } from './ioc.js'

export interface HTTPIncomingMessage extends IncomingMessage, TransactionalContext {
    getURL(): URL
    body(): Promise<string>
    json<T>(): Promise<T>
}

export interface HTTPServerResponse extends ServerResponse {
    setStatusCode(value: number): void
}

export type RegexHTTPControllerHandler = (request: HTTPIncomingMessage, response: HTTPServerResponse) => Promise<void> | void

export interface RegexHTTPController {
    get?: RegexHTTPControllerHandler
    post?: RegexHTTPControllerHandler
    put?: RegexHTTPControllerHandler
    delete?: RegexHTTPControllerHandler
    patch?: RegexHTTPControllerHandler
    handle?: RegexHTTPControllerHandler
}

export type HTTPServer = Server<typeof IncomingMessage, typeof ServerResponse>
export type HTTPBootstrapOutput = { server: HTTPServer }

export class HTTP {
    public static async bootstrap(): Promise<HTTPBootstrapOutput> {
        const server = await createServer(listener)
        return { server }
    }
}

async function listener(request: IncomingMessage, response: ServerResponse) {

    const _request = HTTPHelper.incoming({ message: request, transactional: true })
    const _response = HTTPHelper.response(response)

    try {

        _request.logger.log('call', _request.getURL().pathname)
        MetricHelper.http_received_request_total.inc()
        MetricHelper.http_received_request_total.inc({ path: _request.getURL().pathname })

        if (_request.getURL().pathname === '/') {

            if (!AuthHelper.validate(_request, _response)) {
                return
            }

            const paths = ApplicationHelper.paths()
            _response.setStatusCode(200)
            _response.write(JSON.stringify(paths))
            _response.end()
            return

        }

        const controller = Regex.inject<RegexHTTPController>(_request.getURL().pathname)

        if (!controller) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        const method = _request.method?.toLocaleLowerCase()

        if (!ObjectHelper.has(method)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        if (Array.isArray(controller)) {

            const controllers =
                (controller as any[])
                    .filter(_controller => _handler(_controller, method))
                    .map(_controller => ({ name: _controller[RegexField.TYPE], handler: _handler(_controller, method) }))

            if (controllers.length === 1) {
                await controllers[0].handler(_request, _response)
                return
            }

            _request.logger.error('there are more than one controller found to process this request:', controllers.map(({ name, handler }) => ({ name, handler: handler.name })))
            _response.setStatusCode(500)
            _response.end()
            return
        }

        const handler = _handler(controller, method)

        if (!ObjectHelper.has(handler)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(_request, _response)
            return
        }

        await handler(_request, _response)

    } catch (error) {
        ControllerHelper.catch(_request, _response, error)
    } finally {
        MetricHelper.http_received_request_total.inc({ status: _response.statusCode })
        MetricHelper.http_received_request_total.inc({ path: _request.getURL().pathname, status: _response.statusCode })
        Regex.unregister(_request.logger)
    }

}

function _handler(controller: any, method: string | undefined) {
    return controller[method as string] ?? controller.handle
}