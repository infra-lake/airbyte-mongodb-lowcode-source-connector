import { AuthHelper } from '../helpers/auth.helper'
import { QueryStringHelper } from '../helpers/querystring.helper'
import { Regex, RegexController, Request, Response, TransactionalContext } from '../regex'
import { Export4Save, ExportService } from '../services/export.service'


export class ExportController implements RegexController {

    public static readonly path = '^/export'

    public async post(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const context: TransactionalContext = request
        const entity = await request.json<Export4Save>()

        const service = Regex.inject(ExportService)
        const transaction = await service.register(context, entity)

        response.write(JSON.stringify({ transaction }))
        response.end()

    }

    public async get(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { searchParams } = request.getURL()
        const parameters = QueryStringHelper.parse(searchParams)
        const { filter = {} } = parameters

        const service = Regex.inject(ExportService)

        let count = 0
        service.find(filter).stream()
            .on('resume', () => {
                response.setHeader('Content-Type', 'application/json')
                response.write('{ "results": [')
                response.setStatusCode(200)
            })
            .on('data', chunk => {
                if (++count > 1) {
                    response.write(',')
                }
                delete chunk._id
                response.write(JSON.stringify(chunk))
            })
            .on('end', () => {
                response.write(`], "metadata": { "count": ${count} } }`)
                response.end()
            })
            .on('error', (error) => {
                console.error('error:', error)
                response.setStatusCode(500)
                response.end()
            })

    }

}