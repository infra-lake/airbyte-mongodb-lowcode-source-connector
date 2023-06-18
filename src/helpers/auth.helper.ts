import { Request } from "../regex";
import { EnvironmentHelper } from "./environment.helper";

export class AuthHelper {

    public static validate(request: Request) {
        const [strategy, token] = (request.headers['authorization'] ?? '').split(' ')
        return (this as any)[strategy]?.(token) as boolean ?? false
    }

    private static Basic(token: string): boolean {
        const [user, password] = Buffer.from(token, 'base64').toString('utf-8').split(':')
        return user === EnvironmentHelper.get('AUTH_USER') && password === EnvironmentHelper.get('AUTH_PASS')
    }

}