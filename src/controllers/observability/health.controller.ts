import { RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse } from '../../regex'

export class HealthController implements RegexHTTPController {

    public static readonly path = '^/health/(liveness|readiness)$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {
        response.setStatusCode(200)
        response.end()
    }

}