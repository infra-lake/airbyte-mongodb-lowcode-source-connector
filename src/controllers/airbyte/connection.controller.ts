// import fs from 'fs'
// import Handlebars from 'handlebars'
// import { MongoClient } from 'mongodb'
// import { BadRequestError } from '../../exceptions/badrequest.error'
// import { AirbyteTemplates } from '../../helpers/airbyte.helper'
// import { AuthHelper } from '../../helpers/auth.helper'
// import { MongoDBHelper } from '../../helpers/mongodb.helper'
// import { ObjectHelper } from '../../helpers/object.helper'
// import { QueryStringHelper } from '../../helpers/querystring.helper'
// import { Logger, Regex, RegexController, Request, Response } from '../../regex'

// export class AirbyteConnectionController implements RegexController {

//     static path = '^/airbyte/connection'

//     public constructor() {
//         fs.readdirSync(_templates.path()).forEach(_compile)
//     }

//     async get(request: Request, response: Response) {

//         try {

//             if (!AuthHelper.validate(request, response)) {
//                 return
//             }

//             const { path, parameters } = _input(request)
//             const { version, database } = path

//             if (!ObjectHelper.has(version)) {
//                 const versions = Object.keys(_templates).map(version => ({ version }))
//                 const output = { metadata: { count: versions.length }, results: versions }
//                 response.write(JSON.stringify(output))
//                 response.setStatusCode(200)
//                 response.end()
//                 return
//             }

//             if (!ObjectHelper.has(database)) {
//                 const mongodb = Regex.inject(MongoDBHelper)
//                 const databases = await mongodb.databases()
//                 const output = { metadata: { count: databases.length }, results: databases.map(({ name }) => ({ name })) }
//                 response.write(JSON.stringify(output))
//                 response.setStatusCode(200)
//                 response.end()
//                 return
//             }

//             const streams = await _streams(database)
//             const output = _templates[version]?.({ streams, stamps })

//             response.write(output)
//             response.setStatusCode(200)
//             response.end()

//         } catch (error) {

//             const logger = Logger.from(request)

//             logger.error('error:', error)

//             const bad = error instanceof BadRequestError

//             response.setStatusCode(bad ? 400 : 500)
//             if (bad) {
//                 response.write(error.message)
//             }

//             response.end()

//         }

//     }

// }

// const _templates: AirbyteTemplates = {
//     path: () => './templates/airbyte/connection'
// }

// function _compile(version: string) {
//     if (version in _templates) {
//         return _templates[version]
//     }
//     const template = fs.readFileSync(`${_templates.path()}/${version}/template.hbs`).toString('utf-8')
//     _templates[version] = Handlebars.compile(template, { noEscape: true })
//     return _templates[version]
// }

// type Path = {
//     version: string
//     database: string
// }
// type AirbyteControllerInput = {
//     path: Path
//     parameters: any
// }

// function _input(request: Request): AirbyteControllerInput {

//     const { searchParams, pathname } = request.getURL()
//     const [_, version, database] = pathname.split('/').filter(value => value)

//     const parameters = QueryStringHelper.parse(searchParams)

//     return { path: { version, database }, parameters }

// }

// type AirbyteStream = {
//     database: string,
//     name: string
// }
// async function _streams(database: string): Promise<Array<AirbyteStream>> {

//     const mongodb = Regex.inject(MongoClient)

//     const collections = await mongodb.db(database).collections()

//     const result = collections.map(({ dbName: database, collectionName: name }) => ({ database, name }))

//     return result
// }