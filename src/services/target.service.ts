import { CountOptions, FindOptions, MongoClient } from 'mongodb'
import { BadRequestError } from '../exceptions/badrequest.error'
import { ObjectHelper } from '../helpers/object.helper'
import { Regex } from '../regex'
import { SettingsService } from './settings.service'
import { BigQuery } from '@google-cloud/bigquery'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'

export interface Target extends MongoDBDocument<Target, 'name'> {
    name: string
    credentials: any
}

export class TargetService {

    public static readonly COLLECTION = 'targets'

    public find(filter: Partial<Target>, options?: FindOptions<Target>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: TargetService.COLLECTION, filter, options })
        return result
    }

    public async exists(filter: Partial<Target>, options?: CountOptions) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.exists({ client, database, collection: TargetService.COLLECTION, filter, options })
        return result
    }

    public async save(document: Target) {

        await this.validate(document)

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { name: document.name }

        await MongoDBHelper.save({ client, database, collection: TargetService.COLLECTION, id, document })

    }

    public async validate(entity: Target) {

        if (!ObjectHelper.has(entity)) {
            throw new BadRequestError('target is empty')
        }

        if (!ObjectHelper.has(entity.name)) {
            throw new BadRequestError('target.name is empty')
        }

        if (!ObjectHelper.has(entity.credentials)) {
            throw new BadRequestError('target.credentials is empty')
        }

        try {
            await new BigQuery({ credentials: entity.credentials }).getDatasets({ maxResults: 1 })
        } catch (error) {
            throw new BadRequestError(`does not possible to connect at google big query with received credentials, error:`, error)
        }

    }

}