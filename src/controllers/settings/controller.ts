import { AuthHelper } from '../../helpers/auth.helper'
import { RegexController, Request, Response } from '../../regex'

export class SettingsController implements RegexController {

    public static readonly path = '^/settings$'

    public async get(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const results = [{ settings: "source" }, { settings: "target" }]
        
        response.setHeader('Content-Type', 'application/json')
        response.write(JSON.stringify({ results, metadata: { count: results.length } }))
        response.setStatusCode(200)
        response.end()

    }

}