import Handlebars from 'handlebars'
import { AirbyteHelper } from '../../helpers/airbyte.helper'
import { AuthHelper } from '../../helpers/auth.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { Stamps, StampsHelper } from '../../helpers/stamps.helper'
import { RegexController, Request, Response } from '../../regex'
import { ApplicationHelper } from '../../helpers/application.helper'

export class BuilderAirbyteController implements RegexController {

    public static readonly path = '^/airbyte/builder'
    private static readonly templates = AirbyteHelper.templates('builder')

    public constructor() {
        Handlebars.registerHelper('airbyteConfig', (name) => {
            return `'{{ config[''${name}''] }}'`
        })
        Handlebars.registerHelper('airbyteNow', () => {
            return `'{{ now_utc().strftime(''%Y-%m-%dT%H:%M:%S.%fZ'') }}'`
        })
    }

    public async get(request: Request, response: Response) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const { path, parameters, stamps } = _input(request)
        const { version, database } = path

        if (!ObjectHelper.has(version)) {
            const output = AirbyteHelper.versions(BuilderAirbyteController.templates)
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
        
        const { url_base = ApplicationHelper.URL.BASE, documentation_url = ApplicationHelper.URL.DOCUMENTATION } = parameters
        const streams = await AirbyteHelper.streams(database, parameters)
        const output = BuilderAirbyteController.templates[version]?.({ streams, stamps, url_base, documentation_url })

        response.write(output)
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
    stamps: Stamps
}

function _input(request: Request): AirbyteControllerInput {

    const { searchParams } = request.getURL()
    const { version, database } = AirbyteHelper.path(request)

    const parameters = QueryStringHelper.parse(searchParams)

    const stamps = StampsHelper.extract(parameters)

    return { path: { version, database }, parameters, stamps }

}

