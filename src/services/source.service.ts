import { CountOptions, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { Regex } from '../regex'
import { SettingsService } from './settings.service'

export interface Source extends MongoDBDocument<Source, 'name'> {
    name: string
    url: string
}

export class SourceService {

    public static readonly COLLECTION = 'sources'

    public find(filter: Partial<Source>, options?: FindOptions<Source>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async count(filter: Partial<Source>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.count({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Source>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: SourceService.COLLECTION, filter, options })
        return result
    }

    public async save(document: Source) {

        await this.validate(document)

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { name: document.name }

        await MongoDBHelper.save({ client, database, collection: SourceService.COLLECTION, id, document })

    }

    public async validate(document: Source) {

        if (!ObjectHelper.has(document)) {
            throw new BadRequestError('source is empty')
        }

        if (!ObjectHelper.has(document.name)) {
            throw new BadRequestError('source.name is empty')
        }

        if (!ObjectHelper.has(document.url)) {
            throw new BadRequestError('source.url is empty')
        }

        try {
            await new MongoClient(document.url).connect()
        } catch (error) {
            throw new BadRequestError(`does not possible to connect at mongodb with received url, error:`, error)
        }

    }

}