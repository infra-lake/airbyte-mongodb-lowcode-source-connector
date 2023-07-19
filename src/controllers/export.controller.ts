import { AuthHelper } from '../helpers/auth.helper'
import { QueryStringHelper } from '../helpers/querystring.helper'
import { Regex, RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse, TransactionalContext } from '../regex'
import { Export4Create, ExportService } from '../services/export.service'


export class ExportController implements RegexHTTPController {

    public static readonly path = '^/export'

    public async post(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const entity = await request.json<Export4Create>()
        entity.transaction = request.transaction

        const service = Regex.inject(ExportService)
        const transaction = await service.create(entity)

        response.write(JSON.stringify({ transaction }))
        response.end()

    }

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

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