import fs from 'fs'
import Handlebars from 'handlebars'
import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../exceptions/badrequest.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { Stamps, StampsHelper } from '../../helpers/stamps.helper'
import { Logger, Regex, RegexController, Request, Response } from '../../regex'

export class AirbyteController implements RegexController {

    static path = '^/airbyte'

    public constructor() {
        fs.readdirSync('./src/controllers/airbyte/templates').forEach(_compile)
        Handlebars.registerHelper('airbyteConfig', (name) => {
            return `'{{ config[''${name}''] }}'`
        })
        Handlebars.registerHelper('airbyteNow', () => {
            return `'{{ now_utc().strftime(''%Y-%m-%dT%H:%M:%SZ'') }}'`
        })
    }

    async get(request: Request, response: Response) {

        try {

            if (!AuthHelper.validate(request, response)) {
                return
            }

            const { path, stamps } = _input(request)
            const { database, version } = path
            
            const streams = await _streams(database)
            const output = _templates[version]?.({ streams, stamps })

            response.write(output)
            response.setStatusCode(200)
            response.end()

        } catch (error) {

            const logger = Logger.from(request)

            logger.error('error:', error)

            const bad = error instanceof BadRequestError

            response.setStatusCode(bad ? 400 : 500)
            if (bad) {
                response.write(error.message)
            }

            response.end()

        }

    }

}

const _templates: { [key: string]: HandlebarsTemplateDelegate | undefined } = {}
function _compile(version: string) {
    if (version in _templates) {
        return _templates[version]
    }
    const template = fs.readFileSync(`./src/controllers/airbyte/templates/${version}/template.hbs`).toString('utf-8') 
    _templates[version] = Handlebars.compile(template, { noEscape: true })
    return _templates[version]
}

type Path = {
    version: string
    database: string
}
type AirbyteControllerInput = {
    path: Path
    stamps: Stamps
}

function _input(request: Request): AirbyteControllerInput {

    const { searchParams, pathname } = request.getURL()
    const [_, version, database] = pathname.split('/').filter(value => value)

    const parameters = QueryStringHelper.parse(searchParams)

    const stamps = StampsHelper.extract(parameters)

    return { path: { version, database }, stamps }

}

type AirbyteStream = {
    database: string,
    name: string
}
async function _streams(database: string): Promise<Array<AirbyteStream>> {

    const mongodb = Regex.inject(MongoClient)

    const collections = await mongodb.db(database).collections()

    const result =  collections.map(({ dbName: database, collectionName: name }) => ({ database, name }))

    return result
}