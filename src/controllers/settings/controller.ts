import { AuthHelper } from '../../helpers/auth.helper'
import { RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse } from '../../regex'

export class SettingsController implements RegexHTTPController {

    public static readonly path = '^/settings$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

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