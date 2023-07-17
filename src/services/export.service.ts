import { BigQueryTimestamp } from '@google-cloud/bigquery'
import { createHash } from 'crypto'
import { Document, FindOptions, MongoClient } from 'mongodb'
import { commandOptions } from 'redis'
import { BadRequestError } from '../exceptions/badrequest.error'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { MongoDBDocument, MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { RedisHelper } from '../helpers/redis.helper'
import { Stamps, StampsHelper } from '../helpers/stamps.helper'
import { Window } from '../helpers/window.helper'
import { Regex, TransactionalContext } from '../regex'
import { ExportWorkerTask } from '../workers/export.worker.task'
import { SettingsService } from './settings.service'
import { SourceService } from './source.service'
import { TargetService } from './target.service'

export interface ExportSource {
    name: string
    database: string
    collection: string
}

export interface ExportTarget {
    name: string
}

export interface ExportSettings {
    attempts: number
    stamps: Stamps
}

export interface Export extends MongoDBDocument<Export, 'transaction' | 'source' | 'target'> {
    transaction: string
    source: ExportSource
    target: ExportTarget
    settings: ExportSettings
    window: Window
    status: 'pending' | 'success' | 'error'
    error?: { message: string, cause: any }
}

export type Export4Save = Pick<Export, 'source' | 'target' | 'settings'>

export class ExportService {

    private static readonly DEFAULT_EXPORT_ATTEMPS = '3'
    public static readonly COLLECTION = 'exports'

    private tasks: Record<string, Record<string, ExportWorkerTask>> = {}

    public find(filter: Export, options?: FindOptions<Export>) {
        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const result = MongoDBHelper.find({ client, database, collection: ExportService.COLLECTION, filter, options })
        return result
    }

    public async register(context: TransactionalContext, input: Export4Save) {

        await this.validate(input)

        const output = await this.save(context, input)

        const key = `exports:${output.source.name}:${output.source.database}:${output.source.collection}:${output.target.name}`

        if (!(key in this.tasks)) {
            await this.follow(context, key)
        }

        this.tasks[key][output.transaction] = new ExportWorkerTask(context, output)

        const redis = Regex.inject(RedisHelper)
        await redis.client.xAdd(key, '*', { transaction: output.transaction })

        return output.transaction

    }

    private async save({ transaction }: Pick<TransactionalContext, 'transaction'>, document: Export4Save): Promise<Export> {

        (document as Export).transaction = transaction

        document.settings = document.settings ?? {}
        document.settings.attempts = document.settings.attempts ?? parseInt(EnvironmentHelper.get('EXPORT_ATTEMPS', ExportService.DEFAULT_EXPORT_ATTEMPS))
        document.settings.stamps = StampsHelper.extract(document.settings, 'stamps');

        (document as Export).window = {
            begin: await this.last(document),
            end: new Date()
        };

        (document as Export).status = 'pending'

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)
        const id = { transaction, source: document.source, target: document.target }
        await MongoDBHelper.save({ client, database, collection: ExportService.COLLECTION, id, document: document as Export })

        return document as Export

    }

    private async last({ source, target }: Pick<Export4Save, 'source' | 'target'>): Promise<Date> {

        const client = Regex.inject(MongoClient)
        const { database } = Regex.inject(SettingsService)

        const cursor = client.db(database).collection(ExportService.COLLECTION).aggregate([
            { $match: { source, target, status: 'success' } },
            { $group: { _id: "transaction", value: { $top: { sortBy: { 'window.end': -1 }, output: ["$window.end"] } } } }
        ])

        if (await cursor.hasNext()) {
            const { value } = await cursor.next() as any;
            return value[0]
        }

        return new Date(0)

    }

    public async validate(document: Export4Save) {

        if (!ObjectHelper.has(document)) {
            throw new BadRequestError('export is empty')
        }

        if (!ObjectHelper.has(document.source)) {
            throw new BadRequestError('export.source is empty')
        }

        if (!ObjectHelper.has(document.source.name)) {
            throw new BadRequestError('export.source.name is empty')
        }

        const source = Regex.inject(SourceService)
        if (!await source.exists({ name: document.source.name })) {
            throw new BadRequestError('export.source.name is invalid or does not exists')
        }

        if (!ObjectHelper.has(document.source.database)) {
            throw new BadRequestError('export.source.database is empty')
        }

        if (!ObjectHelper.has(document.source.collection)) {
            throw new BadRequestError('export.source.collection is empty')
        }

        if (!ObjectHelper.has(document.target)) {
            throw new BadRequestError('export.target is empty')
        }

        if (!ObjectHelper.has(document.target.name)) {
            throw new BadRequestError('export.target.name is empty')
        }

        const target = Regex.inject(TargetService)
        if (!await target.exists({ name: document.target.name })) {
            throw new BadRequestError('export.target.name is invalid or does not exists')
        }

        if (ObjectHelper.has(document.settings)) {

            if (ObjectHelper.has(document.settings.attempts) && document.settings.attempts < 0) {
                throw new BadRequestError('export.settings.attempts is invalid')
            }

            if (ObjectHelper.has(document.settings.stamps)) {

                if (ObjectHelper.has(document.settings.stamps.id) && document.settings.stamps.id.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.id is invalid')
                }

                if (ObjectHelper.has(document.settings.stamps.insert) && document.settings.stamps.insert.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.insert is invalid')
                }

                if (ObjectHelper.has(document.settings.stamps.update) && document.settings.stamps.update.trim.length < 1) {
                    throw new BadRequestError('export.settings.stamps.update is invalid')
                }

            }

        }

    }

    private async follow(context: TransactionalContext, key: string) {
        
        if (key in this.tasks) {
            return
        }

        this.tasks[key] = {}

        const redis = Regex.inject(RedisHelper)
        
        await redis.client.xGroupCreate(key, key, '$', { MKSTREAM: true })

        const behaviour = async () => {
            
            const events = await redis.client.xReadGroup(commandOptions({ isolated: true }), key, 'exporter', [{ key, id: '>' }], { COUNT: 1, BLOCK: 0 })

            if (events) {
                
                const client = Regex.inject(MongoClient)
                const { database } = Regex.inject(SettingsService)
                const collection = ExportService.COLLECTION
                
                await Promise.all(events.flatMap(({ name, messages }) => {

                    return messages.flatMap(async ({ id, message }) => {

                        const { transaction } = message 
                        const task = this.tasks[key][transaction]
                        
                        const { data } = task
                        const { source, target } = data
                        
                        context.logger.log(`new event message received:`, { name, id })
                        
                        try {

                            await task.run()

                            context.logger.log(`task "${task.name}" finished successfully`)
                            task.data.status = 'success'
                            
                            await MongoDBHelper.save({ 
                                client, 
                                database, 
                                collection, 
                                id: { transaction, source, target }, 
                                document: task.data 
                            })

                        } catch (error: any) {
                            
                            const _message = `worker ${task.name} was not finished`
                            context.logger.error(_message, error)
                            task.data.status = 'error'
                            task.data.error = { message: 'message' in error ? error.message : _message, cause: 'cause' in error ? error.cause : error }
                        
                            await MongoDBHelper.save({ 
                                client, 
                                database, 
                                collection, 
                                id: { transaction, source, target }, 
                                document: task.data 
                            })
                        
                        } finally {
                            delete this.tasks[key][transaction]
                            await redis.client.xAck(key, 'exporter', id)
                        }
                        
                    })

                }))

            }

        }

        setInterval(() => behaviour().then().catch(context.logger.error), 1000)

    }

    public static filter(stamps: Stamps, window: Window): Document {

        return {
            $expr: {
                $and: [
                    {
                        $gt: [
                            {
                                $ifNull: [
                                    `$${stamps.update}`,
                                    `$updatedAt`,
                                    `$${stamps.insert}`,
                                    `$createdAt`,
                                    {
                                        $convert: {
                                            input: `$${stamps.id}`,
                                            to: "date",
                                            onError: window.end,
                                            onNull: window.end
                                        }
                                    }
                                ]
                            },
                            window.begin
                        ]
                    },
                    {
                        $lte: [
                            {
                                $ifNull: [
                                    `$${stamps.update}`,
                                    `$updatedAt`,
                                    `$${stamps.insert}`,
                                    `$createdAt`,
                                    {
                                        $convert: {
                                            input: `$${stamps.id}`,
                                            to: "date",
                                            onError: window.end,
                                            onNull: window.end
                                        }
                                    }
                                ]
                            },
                            window.end
                        ]
                    }
                ]
            }
        }

    }

    public static row(chunk: any, { id }: Pick<Stamps, 'id'>, date?: Date) {

        const data = JSON.stringify(ExportService.fix(chunk))

        return {
            [id]: chunk[id].toString(),
            [EnvironmentHelper.get('DEFAULT_STAMP_INSERT', 'createdAt')]: new BigQueryTimestamp(date ?? new Date()),
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

    private static fix(object: any): any {

        if (!ObjectHelper.has(object)) {
            return object
        }

        if (Array.isArray(object)) {
            object.forEach(ExportService.fix)
            return object
        }

        if (typeof object === 'object') {

            Object.keys(object).forEach(key => {

                if (key.trim() === '') {
                    const value = object[key]
                    delete object[key]
                    object['__empty__'] = ExportService.fix(value)
                    return
                }

                object[key] = ExportService.fix(object[key])

            })

            return object

        }

        return object

    }

}