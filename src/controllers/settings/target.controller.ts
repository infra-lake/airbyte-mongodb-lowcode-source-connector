import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { Regex, RegexController, Request, Response } from '../../regex'
import { Target, TargetService } from '../../services/target.service'

export class TargetSettingsController implements RegexController {

    public static readonly path = '^/settings/target$'

    public async post(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const entity = await request.json<Target>()

        const service = Regex.inject(TargetService)

        await service.save(entity)

        response.write(JSON.stringify({ transaction: request.transaction }))
        response.end()

    }

    public async get(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { searchParams } = request.getURL()
        const parameters = QueryStringHelper.parse(searchParams)
        const { filter = {} } = parameters

        const service = Regex.inject(TargetService)

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