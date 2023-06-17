import { LoggerHelper } from '../helpers/logger.helper.mjs'

export class NotFoundController {

    static path = '^404$'
    
    async handle(request, response) {
        const logger = LoggerHelper.from(request)
        logger.error('page not found')
        response.statusCode = 404
        response.end()
    }

}