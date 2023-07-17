import { randomUUID } from 'crypto'
import { BigQuery } from '@google-cloud/bigquery'
import { MongoClient } from 'mongodb'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { MongoDBHelper } from '../helpers/mongodb.helper'
import { Regex, TransactionalContext, WorkerTask } from '../regex'
import { Export, ExportService } from '../services/export.service'
import { Source, SourceService } from '../services/source.service'
import { Target, TargetService } from '../services/target.service'
import { ObjectHelper } from '../helpers/object.helper'

export class ExportWorkerTask extends WorkerTask {

    public constructor(
        private readonly _context: TransactionalContext,
        private readonly _data: Export
    ) { super() }

    public get context() { return this._context }
    public get data() { return this._data }

    public get name(): string {
        const name = ExportWorkerTask.name
        const from = `${this.data.source.name}.${this.data.source.database}.${this.data.source.collection}`
        const to = this.data.target.name
        return JSON.stringify({ name, from, to })
    }

    protected get logger() { return this.context.logger }

    protected get attempts() { return this.data.settings.attempts }

    private get stamps() { return this.data.settings.stamps }

    private get window() { return this.data.window }

    protected async perform(attempt: number, error: Error) {

        let source
        let target

        try {

            const now = new Date()

            this.logger.log('starting export task:', JSON.parse(this.name))

            source = await this.source()
            target = await this.target()

            const count = await MongoDBHelper.count(source)
            this.logger.log(`exporting ${count} row(s)...`)

            const cursor = MongoDBHelper.find(source)
            while (await cursor.hasNext()) {

                const document = await cursor.next()

                const row = ExportService.row(document, this.stamps, now)

                try {
                    await target.table.temporary.insert([row])
                } catch (error) {
                    this.logger.error(`error on export row:\n\t${JSON.stringify(row)}`)
                    throw error
                }

            }

            const main = `\`${target.table.main.metadata.id.replace(/\:/g,'.').replace(/\./g,'\`.`')}\``
            const temporary = `\`${target.table.temporary.metadata.id.replace(/\:/g,'.').replace(/\./g,'\`.`')}\``

            await target.client.query(`
                INSERT ${main} (_id, createdAt, data, \`hash\`)
                WITH
                    temporary AS (
                        SELECT _id, createdAt, data, \`hash\`
                        FROM ${temporary}
                    ),
                    main AS (
                        SELECT _id, MAX(createdAt) AS createdAt
                        FROM ${main}
                        GROUP BY _id
                    )
                    SELECT temporary._id, temporary.createdAt, temporary.data, temporary.\`hash\`
                    FROM temporary
                    WHERE temporary._id NOT IN (SELECT main._id FROM main)
                       OR \`hash\` <> (
                            SELECT \`hash\`
                            FROM main AS B
                            INNER JOIN ${main} AS C
                                    ON C._id = B._id
                                   AND C.createdAt = B.createdAt
                            WHERE B._id = temporary._id
                              AND C._id = temporary._id
                       )
            `)

            this.logger.log(`all ${count} row(s) was exported successfully`)

        } catch (error) {
            
            this.logger.error(`error on export:\n\t${error}`)
            throw error

        } finally {

            if (ObjectHelper.has(target)) {
                try {
                    await target?.table.temporary.delete({ ignoreNotFound: true })
                } catch (error) {
                    console.error(`fail to delete temporary table: ${target?.table.temporary.id}:\n\t${JSON.stringify(error)}`)
                }
            }
            
            Regex.unregister(`source.${this.context.transaction}`)
            Regex.unregister(`target.${this.context.transaction}`)
        
        }

    }

    private async source() {

        const transaction = this.context.transaction

        const service = Regex.inject(SourceService)

        const { name, database, collection } = this.data.source

        const { uri } = await service.find({ name }).next() as Source

        const client = Regex.register(class extends MongoClient {
            public static regex = `source.${transaction}`
        }, uri)

        const filter = ExportService.filter(this.stamps, this.window)

        return { client, database, collection, filter }

    }

    private async target() {

        const transaction = this.context.transaction

        const service = Regex.inject(TargetService)

        const { name } = this.data.target

        const { credentials } = await service.find({ name }).next() as Target

        const client = Regex.register(class extends BigQuery {
            public static regex = `target.${transaction}`
        }, { credentials })

        const { database } = this.data.source

        const dataset = `raw_mongodb_${database}`

        const main = await BigQueryHelper.table({ client, dataset, table: this.table('main') })
        const temporary = await BigQueryHelper.table({ client, dataset, table: this.table('temporary') })
        
        return { client, dataset, table: { main, temporary } }

    }

    private table(type: 'main' | 'temporary') {

        const { collection } = this.data.source

        let name = collection.trim().replace(/\-/g, '_').replace(/\./g, '_').replace(/\s/g, '_')

        if (type === 'temporary') {
            name = `${name}_${randomUUID().replace(/\-/g, '')}_temp`
        }

        return {
            name,
            fields: [
                { name: this.stamps.id, type: 'STRING', mode: 'REQUIRED' },
                { name: this.stamps.insert, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

    }

}