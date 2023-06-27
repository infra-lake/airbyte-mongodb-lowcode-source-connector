import { CountOptions, FindOptions, MongoClient, WithId } from 'mongodb'
import Stream from 'stream'
import { Regex } from '../regex'

export class MongoDBHelper {

    public async databases() {

        const momgodb = Regex.inject(MongoClient)

        const result = await momgodb.db().admin().listDatabases()

        return result.databases

    }

    public async collections(database: string) {

        const momgodb = Regex.inject(MongoClient)

        const result = await momgodb.db(database).collections()

        return result

    }

    public find<T extends Document = Document>(database: string, collection: string, filter: T, options: FindOptions<T>): Stream.Readable & AsyncIterable<WithId<T>> {

        const mongodb = Regex.inject(MongoClient)
        
        const result = mongodb.db(database).collection(collection).find(filter, options)

        if ('sort' in options && options.sort !== null && options.sort !== undefined) {
            return result.allowDiskUse().stream()
        }
        
        return result.stream()

    }

    public async count<T extends Document = Document>(database: string, collection: string, filter: T, options: CountOptions) {

        const mongodb = Regex.inject(MongoClient)
        
        const result = await mongodb.db(database).collection(collection).countDocuments(filter, options)

        return result

    }

}