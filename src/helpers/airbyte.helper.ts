import fs from 'fs'
import Handlebars from 'handlebars'
import { MongoClient } from 'mongodb'
import { Regex, Request } from '../regex'
import { MongoDBHelper } from './mongodb.helper'

export type AirbyteTemplatesType = 'builder' | 'connection'
export type AirbyteTemplates = { [key: string]: HandlebarsTemplateDelegate | undefined }
export type AirbyteStream = { database: string, name: string }
export type AirbyteStreamsOptions = {
    remove?: string[]
}

export class AirbyteHelper {

    private static readonly _path = './templates/airbyte'

    public static templates(type: AirbyteTemplatesType) {
        const templates: AirbyteTemplates = {}
        fs.readdirSync(`${AirbyteHelper._path}/${type}`).forEach(version => {
            if (version in templates) {
                return templates[version]
            }
            const template = fs.readFileSync(`${AirbyteHelper._path}/${type}/${version}/template.hbs`).toString('utf-8')
            templates[version] = Handlebars.compile(template, { noEscape: true })
        })
        return templates
    }

    public static path(request: Request) {
        const { pathname } = request.getURL()
        const [airbyte, builder, version, database] = pathname.split('/').filter(value => value)
        return { version, database }
    }

    public static features() {
        const features = fs.readdirSync(AirbyteHelper._path)
        return { metadata: { count: features.length }, results: features.map(feature => ({ feature })) }
    }

    public static versions(templates: AirbyteTemplates) {
        const versions = Object.keys(templates).filter(key => key !== 'path').map(version => ({ version }))
        return { metadata: { count: versions.length }, results: versions }
    }

    public static async databases() {
        const mongodb = Regex.inject(MongoDBHelper)
        const databases = await mongodb.databases()
        return { metadata: { count: databases.length }, results: databases.map(({ name }) => ({ database: name })) }
    }

    public static async streams(database: string, { remove = [] }: AirbyteStreamsOptions | undefined = {}): Promise<Array<AirbyteStream>> {
        const mongodb = Regex.inject(MongoClient)
        const collections = await mongodb.db(database).collections()
        const result =
            collections
                .map(({ dbName: database, collectionName: name }) => ({ database, name }))
                .filter(({ name }) => (remove ?? []).length > 0 ? remove.includes(name) : true)
                .sort((a, b) => a.name.localeCompare(b.name))
        return result
    }

}