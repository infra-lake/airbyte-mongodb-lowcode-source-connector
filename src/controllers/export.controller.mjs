import { MongoClient } from 'mongodb'
import { LoggerHelper } from '../helpers/logger.helper.mjs'
import { RegExpIOCHelper } from '../helpers/regexpioc.helper.mjs'

export class ExportController {

    static path = '^/export'
    
    async handle(request, response) {

        const mongodb = RegExpIOCHelper.inject(MongoClient)
                
        const logger = LoggerHelper.from(request)
        logger.log('oi')
        response.statusCode = 200
        response.end()
    }

}