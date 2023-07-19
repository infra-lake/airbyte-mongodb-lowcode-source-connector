import { AggregateOptions, CountOptions, Document, FindCursor, FindOptions, MongoClient, WithId } from 'mongodb'
import Stream from 'stream'
import { ObjectHelper } from './object.helper'
import { Stamps } from './stamps.helper'
import { Window } from './window.helper'
import { ApplicationHelper } from './application.helper'

export interface MongoDBDocument<T extends MongoDBDocument<T, K>, K extends keyof T> {

}

export type DatabasesInput = { client: MongoClient }
export type CollectionsInput = { client: MongoClient, database: string }
export type FindInput<T extends Document = Document> = { client: MongoClient, database: string, collection: string, filter: T, options?: FindOptions<T> }
export type GetInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { client: MongoClient, database: string, collection: string, id: Pick<T, K> }
export type CountInput<T extends Document = Document> = { client: MongoClient, database: string, collection: string, filter: T, options?: CountOptions }
export type ExistsInput<T extends Document = Document> = CountInput<T>
export type SaveInput<T extends MongoDBDocument<T, K>, K extends keyof T> = { client: MongoClient, database: string, collection: string, id: Pick<T, K>, document: T }
export type LastInput = { client: MongoClient, database: string, collection: string, match: any, id: string, sortBy: any, output: string[] }

export class MongoDBHelper {

    private constructor() { }

    public static async databases({ client }: DatabasesInput) {
        const result = await client.db().admin().listDatabases()
        return result.databases
    }

    public static async collections({ client, database }: CollectionsInput) {
        const result = await client.db(database).collections()
        return result.filter(({ collectionName }) => !ApplicationHelper.REMOVE.COLLECTIONS.includes(collectionName))
    }

    public static find<T extends Document = Document>({ client, database, collection, filter, options }: FindInput<T>) {
        const result = client.db(database).collection(collection).find<T>(filter, options)
        if (ObjectHelper.has(options?.sort)) {
            return result.allowDiskUse()
        }
        return result
    }

    public static async get<T extends MongoDBDocument<T, K>, K extends keyof T>({ client, database, collection, id }: GetInput<T, K>): Promise<T | undefined> {
        const result = await client.db(database).collection(collection).findOne<T>(id)
        return result ?? undefined
    }

    public static async count<T extends Document = Document>({ client, database, collection, filter, options }: CountInput<T>) {
        const result = await client.db(database).collection(collection).countDocuments(filter, options)
        return result
    }

    public static async exists<T extends Document = Document>(input: ExistsInput<T>) {
        const count = await MongoDBHelper.count(input)
        const result = count > 0
        return result
    }

    public static async save<T extends MongoDBDocument<T, K>, K extends keyof T>({ client, database, collection, id, document }: SaveInput<T, K>) {
        if (await MongoDBHelper.exists({ client, database, collection, filter: id })) {
            await client.db(database).collection(collection).findOneAndReplace(id, document, { upsert: true })
            return
        }
        await client.db(database).collection(collection).insertOne(document)
    }

}