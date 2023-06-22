import { Request, Response } from "../regex";
import { EnvironmentHelper } from "./environment.helper";

const NO_AUTH = 'NO_AUTH'

export class AuthHelper {

    public static validate(request: Request, response: Response) {

        const mode = EnvironmentHelper.get('AUTH_MODE', NO_AUTH).toLowerCase()
        const authorization = request.headers['authorization'] ?? ''
        const [strategy = NO_AUTH, token = ''] = authorization.split(' ').filter(value => value)
        const method = strategy.toLowerCase()

        if (mode === method) {
            const result = (this as any)[method]?.(token) as boolean ?? false
            if (!result) {
                response.setStatusCode(401)
                response.end()
            }
            return result
        }

        response.setStatusCode(401)
        response.end()
        return false

    }

    private static no_auth(token: string): boolean {
        return true
    }

    private static basic(token: string): boolean {
        const [user, password] = Buffer.from(token, 'base64').toString('utf-8').split(':')
        return user === EnvironmentHelper.get('AUTH_USER') && password === EnvironmentHelper.get('AUTH_PASS')
    }

}