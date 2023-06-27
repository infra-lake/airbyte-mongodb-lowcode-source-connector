import fs from 'fs'
import Handlebars from 'handlebars'
import { MongoClient } from 'mongodb'
import { BadRequestError } from '../../exceptions/badrequest.error'
import { AuthHelper } from '../../helpers/auth.helper'
import { MongoDBHelper } from '../../helpers/mongodb.helper'
import { ObjectHelper } from '../../helpers/object.helper'
import { QueryStringHelper } from '../../helpers/querystring.helper'
import { Stamps, StampsHelper } from '../../helpers/stamps.helper'
import { Logger, Regex, RegexController, Request, Response } from '../../regex'

export class AirbyteBuilderController implements RegexController {

    static path = '^/airbyte/builder'

    public constructor() {
        fs.readdirSync(_templates.path()).forEach(_compile)
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
            const { version, database } = path

            if (!ObjectHelper.has(version)) {
                const versions = Object.keys(_templates).filter(key => key !== 'path').map(version => ({ version }))
                const output = { metadata: { count: versions.length }, results: versions }
                response.write(JSON.stringify(output))
                response.setStatusCode(200)
                response.end()
                return
            }

            if (!ObjectHelper.has(database)) {
                const mongodb = Regex.inject(MongoDBHelper)
                const databases = await mongodb.databases()
                const output = { metadata: { count: databases.length }, results: databases.map(({ name }) => ({ name })) }
                response.write(JSON.stringify(output))
                response.setStatusCode(200)
                response.end()
                return
            }

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

const _templates: { [key: string]: HandlebarsTemplateDelegate | undefined, path: () => string } = {
    path: () => './templates/airbyte/builder' 
}

function _compile(version: string) {
    if (version in _templates) {
        return _templates[version]
    }
    const template = fs.readFileSync(`${_templates.path()}/${version}/template.hbs`).toString('utf-8')
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
    const [airbyte, builder, version, database] = pathname.split('/').filter(value => value)

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

    const result = collections.map(({ dbName: database, collectionName: name }) => ({ database, name }))

    return result
}