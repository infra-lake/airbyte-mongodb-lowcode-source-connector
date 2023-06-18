import { createServer, Server as HTTPServer, IncomingMessage, ServerResponse } from 'http'
import { RegexField, Regex } from './ioc.js'
import { Logger } from './logger.js'
import { MetricHelper } from '../helpers/metric.helper.js'
import { NotFoundController } from '../controllers/notfound.controller.js'


export interface Request extends IncomingMessage { 
    logger: Logger
    getURL(): URL
}

export interface Response extends ServerResponse { }

export type ControllerHandler = (request: Request, response: Response) => Promise<void> | void

export interface RegexController {
    get?: ControllerHandler
    post?: ControllerHandler
    put?: ControllerHandler
    delete?: ControllerHandler
    patch?: ControllerHandler
    handle?: ControllerHandler
}

async function listener(incomeMessage: IncomingMessage, serverResponse: ServerResponse) {

    const request = incomeMessage as any as Request
    request.logger = Regex.register(Logger)
    request.getURL = () => new URL(request.url as string, `http://${request.headers.host}`)

    const response = serverResponse as any as ServerResponse
        
    try {

        request.logger.log('call', request.getURL().pathname)
        MetricHelper.http_received_request_total.inc()
        MetricHelper.http_received_request_total.inc({ path: request.getURL().pathname })

        const controller = Regex.inject<RegexController>(request.getURL().pathname)

        if (!controller) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(request, response)
            return
        }

        if (Array.isArray(controller)) {
            const controllers = controller.map(({ [RegexField.TYPE]: name }) => name)
            request.logger.error('there are more than one controller found:', controllers)
            response.statusCode = 500
            response.end()
            return
        }

        const method = request.method?.toLocaleLowerCase()

        if (method === null || method === undefined) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(request, response)
            return
        }

        const handler = (controller as any)[method] ?? controller.handle

        if (!controller) {
            const controller = Regex.inject<NotFoundController>('404')
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
        MetricHelper.http_received_request_total.inc({ path: request.getURL().pathname, status: response.statusCode })
        Regex.unregister(request.logger)
    }

}

function exit(shutdown: Shutdown) {
    return async () => {
        if (shutdown) {
            await shutdown()
        }
        process.exit(0)
    }
}

export type Server = HTTPServer<typeof IncomingMessage, typeof ServerResponse>
export type Startup = ((server: Server) => Promise<void>) | ((server: Server) => void)
export type Shutdown = (() => Promise<void>) | (() => void) | undefined
export type RegexAppCreateInput = { startup: Startup, shutdown?: Shutdown }

export class RegexApplication {

    public static async create({ startup, shutdown }: RegexAppCreateInput) {

        process.on('SIGILL', exit(shutdown))
        process.on('SIGTERM', exit(shutdown))
        process.on('SIGINT', exit(shutdown))

        const server = await createServer(listener)
        
        await startup(server)

    }
}