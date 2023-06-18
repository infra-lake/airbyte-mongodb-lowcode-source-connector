import { MongoClient } from 'mongodb'
import { Regex, RegexController, Request, Response } from '../regex'
import { AuthHelper } from '../helpers/auth.helper'
import { NotFoundController } from './notfound.controller'

export class ExportController implements RegexController {

    static path = '^/export'
    
    async handle(request: Request, response: Response) {

        if (!AuthHelper.validate(request)) {
            const controller = Regex.inject(NotFoundController)
            await controller.handle(request, response)
            return
        }

        const mongodb = Regex.inject(MongoClient)
        
        const db = mongodb.db('admin')
        const collection = db.collection('system.users')
        const query = { user: 'mongodb' };
        // collection.find().stream().pipe(response)
        collection.find(query, { raw: true }).stream().pipe(process.stdout)
        response.setHeader('Content-Type','application/json')
        response.statusCode = 200
        response.end()
    }

}