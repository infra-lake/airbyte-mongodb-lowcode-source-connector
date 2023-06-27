import { AirbyteHelper } from '../../helpers/airbyte.helper'
import { RegexController, Request, Response } from '../../regex'

export class AirbyteController implements RegexController {

    public static readonly path = '^/airbyte/?$'

    public async get(request: Request, response: Response) {

        const output = AirbyteHelper.features()
        response.write(JSON.stringify(output))
        response.setStatusCode(200)
        response.end()

    }

}