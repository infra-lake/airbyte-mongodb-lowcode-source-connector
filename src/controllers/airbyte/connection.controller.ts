import { AirbyteHelper } from '../../helpers/airbyte.helper'
import { ArrayHelper } from '../../helpers/array.helper'
import { AuthHelper } from '../../helpers/auth.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { RegexController, Request, Response } from '../../regex'

export class ConnectionAirbyteController implements RegexController {

    public static readonly path = '^/airbyte/connection'
    private static readonly templates = AirbyteHelper.templates('connection')

    public async get(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { path, parameters } = _input(request)
        const { version, database } = path

        if (!ObjectHelper.has(version)) {
            const output = AirbyteHelper.versions(ConnectionAirbyteController.templates)
            response.write(JSON.stringify(output))
            response.setStatusCode(200)
            response.end()
            return
        }

        if (!ObjectHelper.has(database)) {
            const output = await AirbyteHelper.databases()
            response.write(JSON.stringify(output))
            response.setStatusCode(200)
            response.end()
            return
        }

        const streams = await AirbyteHelper.streams(database, parameters)
        const { split } = parameters

        ArrayHelper
            .split(streams, split)
            .forEach(streams => {
                const output = ConnectionAirbyteController.templates[version]?.({ streams, parameters })
                response.write(output)
            })

        response.setStatusCode(200)
        response.end()

    }

}

type Path = {
    version: string
    database: string
}

type AirbyteControllerInput = {
    path: Path
    parameters: any
}

function _input(request: Request): AirbyteControllerInput {

    const { searchParams } = request.getURL()
    const { version, database } = AirbyteHelper.path(request)

    const parameters = QueryStringHelper.parse(searchParams)

    return { path: { version, database }, parameters }

}