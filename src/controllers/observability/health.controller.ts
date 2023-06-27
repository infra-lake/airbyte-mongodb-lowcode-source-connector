import { RegexController, Request, Response } from '../../regex'

export class HealthController implements RegexController {

    public static readonly path = '^/health/(liveness|readiness)$'

    public async get(request: Request, response: Response) {
        response.setStatusCode(200)
        response.end()
    }

}