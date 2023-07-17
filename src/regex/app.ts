import { createServer, Server as HTTPServer, IncomingMessage, ServerResponse } from 'http'
import { RegexField, Regex } from './ioc.js'
import { Logger } from './logger.js'
import { MetricHelper } from '../helpers/metric.helper.js'
import { NotFoundController } from '../controllers/default/notfound.controller.js'
import { ResilienceHelper } from '../helpers/resilience.helper.js'
import { ObjectHelper } from '../helpers/object.helper.js'
import { ControllerHelper } from '../helpers/controller.helper.js'
import { ApplicationHelper } from '../helpers/application.helper.js'
import { AuthHelper } from '../helpers/auth.helper.js'
import { HTTPHelper } from '../helpers/http.helper.js'

export interface TransactionalContext {
    transaction: string
    logger: Logger
}

export interface Request extends IncomingMessage, TransactionalContext { 
    getURL(): URL
    body(): Promise<string>
    json<T>(): Promise<T>
}

export interface Response extends ServerResponse {
    setStatusCode(value: number): void
 }

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
    request.transaction = request.logger.transaction as string
    request.getURL = () => new URL(request.url as string, `http://${request.headers.host}`)
    request.body = async () => await HTTPHelper.body(request)
    request.json = async <T>() => JSON.parse(await request.body()) as T

    const response = serverResponse as any as Response
    response.setStatusCode = value =>  {
        if (value === 401 || value === 423 || value === 429 || value >= 500) {
            ResilienceHelper.increment()
            response.setHeader('Retry-After', ResilienceHelper.backoff())
        }
        response.statusCode = value
    }
        
    try {

        request.logger.log('call', request.getURL().pathname)
        MetricHelper.http_received_request_total.inc()
        MetricHelper.http_received_request_total.inc({ path: request.getURL().pathname })

        if (request.getURL().pathname === '/') {

            if (!AuthHelper.validate(request, response)) {
                return
            }

            const paths = ApplicationHelper.paths()
            response.setStatusCode(200)
            response.write(JSON.stringify(paths))
            response.end()
            return
            
        }

        const controller = Regex.inject<RegexController>(request.getURL().pathname)

        if (!controller) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(request, response)
            return
        }

        const method = request.method?.toLocaleLowerCase()

        if (!ObjectHelper.has(method)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(request, response)
            return
        }

        if (Array.isArray(controller)) {
            
            const controllers = 
                (controller as any[])
                    .filter(_controller => _handler(_controller, method))
                    .map(_controller => ({ name: _controller[RegexField.TYPE], handler: _handler(_controller, method) }))

            if (controllers.length === 1) {
                await controllers[0].handler(request, response)
                return
            }

            request.logger.error('there are more than one controller found to process this request:', controllers.map(({ name, handler }) => ({ name, handler: handler.name })))
            response.setStatusCode(500)
            response.end()
            return
        }
        
        const handler = _handler(controller, method)

        if (!ObjectHelper.has(handler)) {
            const controller = Regex.inject<NotFoundController>('404')
            await controller.handle(request, response)
            return
        }

        await handler(request, response)

    } catch (error) {
        ControllerHelper.catch(request, response, error)
    } finally {
        MetricHelper.http_received_request_total.inc({ status: response.statusCode })
        MetricHelper.http_received_request_total.inc({ path: request.getURL().pathname, status: response.statusCode })
        Regex.unregister(request.logger)
    }

}

function _handler(controller: any, method: string | undefined) {
    return controller[method as string] ?? controller.handle
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