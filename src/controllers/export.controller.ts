import { MongoClient } from 'mongodb'
import { Regex, RegexController, Request, Response } from '../regex'

type SkipInput = { limit: number, offset: number, page: number }
function skip({ limit, offset, page }: SkipInput) {
    return page > 0 
        ? limit * (page < 0 ? 0 : page)
        : offset < 0 ? 0 : offset
}

export class ExportController implements RegexController {

    static path = '^/export'

    public async get(request: Request, response: Response) {

        // if (!AuthHelper.validate(request)) {
        //     const controller = Regex.inject(NotFoundController)
        //     await controller.handle(request, response)
        //     return
        // }

        const { pathname, searchParams } = request.getURL()

        const sort = searchParams.getAll('sort')
            .map(param => param.split(':'))
            .reduce((sort: any, [key, value]) => ({ ...sort, [key]: value }), {})
        const limit = parseInt(searchParams.get('limit') ?? '10')

        const offset = parseInt(searchParams.get('offset') ?? '0')
        const page = parseInt(searchParams.get('page') ?? '0')
        
        const [_, database, collection, base64] = pathname.split('/').filter(value => value)

        const mongodb = Regex.inject(MongoClient)

        let lenth = 0

        const options = base64 
            ? JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) 
            : { sort, limit, skip: skip({ limit, offset, page }) }

        const token = Buffer.from(JSON.stringify(options), 'utf-8').toString('base64')
        
        const count = await mongodb.db(database).collection(collection).countDocuments({}, options)
        
        const next = count < limit 
            ? false 
            : await mongodb.db(database).collection(collection).countDocuments({}, { ...options, limit: 1, skip: options.skip + options.limit + 1 }) > 0
        
        
        mongodb.db(database).collection(collection).find({}, options).stream()
            .on('resume', () => {
                response.setHeader('Content-Type', 'application/json')
                response.write(`{ "metadata": { "count": ${count}, "next": ${next}, "token": "${token}" }, "results": [`)
                response.statusCode = 200
            })
            .on('data', chunk => {
                if (++lenth > 1) {
                    response.write(',')
                }
                response.write(JSON.stringify(chunk))
            })
            .on('end', () => {
                response.write('] }')
                response.end()
            })
            .on('error', (error) => {
                console.error('error:', error)
            })
    }

}