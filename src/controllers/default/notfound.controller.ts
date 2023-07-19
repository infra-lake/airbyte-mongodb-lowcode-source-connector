import { Logger, RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse } from '../../regex'

export class NotFoundController implements RegexHTTPController {

    public static readonly path = '^404$'

    public async handle(request: HTTPIncomingMessage, response: HTTPServerResponse) {
        const logger = Logger.from(request)
        logger.error('page not found')
        response.setStatusCode(404)
        response.end()
    }

}