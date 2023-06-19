import { Logger, RegexController, Request, Response } from '../regex'

export class NotFoundController implements RegexController {

    static path = '^404$'

    async handle(request: Request, response: Response) {
        const logger = Logger.from(request)
        logger.error('page not found')
        response.setStatusCode(404)
        response.end()
    }

}