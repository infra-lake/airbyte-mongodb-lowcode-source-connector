import { BigQuery, BigQueryTimestamp, Table } from '@google-cloud/bigquery'
import { createHash, randomUUID } from 'crypto'
import { MongoClient } from 'mongodb'
import { BigQueryHelper } from '../helpers/bigquery.helper'
import { MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { StampsHelper } from '../helpers/stamps.helper'
import { Regex, TransactionalContext, Worker } from '../regex'
import { Export, ExportService } from '../services/export.service'
import { Source, SourceService } from '../services/source.service'
import { Target, TargetService } from '../services/target.service'

type ExportWorkerSource = { client: MongoClient, database: string, collection: string, filter: any }
type ExportWorkerTarget = { client: BigQuery, dataset: string, table: { main: Table, temporary: Table } }

export class ExportWorker extends Worker {

    public constructor(
        private readonly _context: TransactionalContext,
        private readonly _data: Export
    ) { super() }

    public get name(): string {
        const name = ExportWorker.name
        const from = `${this.data.source.name}.${this.data.source.database}.${this.data.source.collection}`
        const to = this.data.target.name
        return JSON.stringify({ name, from, to })
    }

    public get context() { return this._context }
    public get data() { return this._data }
    protected get logger() { return this.context.logger }
    protected get attempts() { return this.data.settings.attempts }
    private get stamps() { return this.data.settings.stamps }
    private get limit() { return this.data.settings.limit }
    private get window() { return this.data.window }

    protected async perform() {

        let source: ExportWorkerSource | undefined = undefined
        let target: ExportWorkerTarget | undefined = undefined

        try {

            const now = new Date()
            this.logger.log('starting export task"', JSON.parse(this.name), '" at "', now.toISOString(), '"')

            source = await this.source()
            target = await this.target()

            let count = await MongoDBHelper.count(source)
            this.logger.log(`exporting ${count} row(s)...`)

            let batch = []

            const cursor = MongoDBHelper.find(source)
            while (await cursor.hasNext()) {

                const document = await cursor.next()

                const row = this.row(document, now)

                const flush = (--count % this.limit) === 0 || count <= 0

                if (flush) {
                    await target.table.temporary.insert(batch)
                    batch = []
                } else {
                    batch.push(row)
                }

            }

            await this.consolidate(target)

            this.logger.log(`exported was successfully finished`)

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

        }

    }

    private async source(): Promise<ExportWorkerSource> {

        const service = Regex.inject(SourceService)

        const { name, database, collection } = this.data.source

        const { url } = await service.find({ name }).next() as Source

        const client = new MongoClient(url)

        const filter = ExportService.filter(this.stamps, this.window)

        return { client, database, collection, filter }

    }

    private async target(): Promise<ExportWorkerTarget> {

        const service = Regex.inject(TargetService)

        const { name } = this.data.target

        const { credentials } = await service.find({ name }).next() as Target

        const client = new BigQuery({ credentials })

        const { database } = this.data.source

        const dataset = BigQueryHelper.sanitize({ value: `${this.stamps.dataset.name}${database}`, to: 'dataset-name' })

        const main = await BigQueryHelper.table({ client, dataset, table: this.table('main') })
        const temporary = await BigQueryHelper.table({ client, dataset, table: this.table('temporary') })

        return { client, dataset, table: { main, temporary } }

    }

    private table(type: 'main' | 'temporary') {

        const { collection } = this.data.source

        let name = BigQueryHelper.sanitize({ value: collection, to: 'table-name' })

        if (type === 'temporary') {
            name = BigQueryHelper.sanitize({ value: `${name}_${randomUUID()}_temp`, to: 'table-name' })
        }

        return {
            name,
            fields: [
                { name: StampsHelper.DEFAULT_STAMP_ID, type: 'STRING', mode: 'REQUIRED' },
                { name: StampsHelper.DEFAULT_STAMP_INSERT, type: 'TIMESTAMP', mode: 'REQUIRED' },
                { name: 'data', type: 'JSON', mode: 'REQUIRED' },
                { name: 'hash', type: 'STRING', mode: 'REQUIRED' }
            ]
        }

    }

    private row(chunk: any, date: Date) {

        const data = JSON.stringify(this.fix(chunk))

        return {
            [StampsHelper.DEFAULT_STAMP_ID]: chunk[this.stamps.id].toString(),
            [StampsHelper.DEFAULT_STAMP_INSERT]: new BigQueryTimestamp(date),
            data,
            hash: createHash('md5').update(data).digest('hex')
        }

    }

    private fix(object: any): any {

        if (!ObjectHelper.has(object)) {
            return object
        }

        if (Array.isArray(object)) {
            object.forEach(this.fix)
            return object
        }

        if (typeof object === 'object') {

            Object.keys(object).forEach(key => {

                if (key.trim() === '') {
                    const value = object[key]
                    delete object[key]
                    object['__empty__'] = this.fix(value)
                    return
                }

                object[key] = this.fix(object[key])

            })

            return object

        }

        return object

    }

    private async consolidate(target: ExportWorkerTarget) {

        const main = BigQueryHelper.sanitize({ value: target.table.main.metadata.id.replace(/\:/g, '.'), to: 'sql' })
        const temporary = BigQueryHelper.sanitize({ value: target.table.temporary.metadata.id.replace(/\:/g, '.'), to: 'sql' })

        await target.client.query(`
                INSERT ${main} (${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`)
                WITH
                    temporary AS (
                        SELECT ${StampsHelper.DEFAULT_STAMP_ID}, ${StampsHelper.DEFAULT_STAMP_INSERT}, data, \`hash\`
                        FROM ${temporary}
                    ),
                    main AS (
                        SELECT ${StampsHelper.DEFAULT_STAMP_ID}, MAX(${StampsHelper.DEFAULT_STAMP_INSERT}) AS ${StampsHelper.DEFAULT_STAMP_INSERT}
                        FROM ${main}
                        GROUP BY ${StampsHelper.DEFAULT_STAMP_ID}
                    )
                SELECT temporary.${StampsHelper.DEFAULT_STAMP_ID}, temporary.${StampsHelper.DEFAULT_STAMP_INSERT}, temporary.data, temporary.\`hash\`
                FROM temporary
                WHERE temporary.${StampsHelper.DEFAULT_STAMP_ID} NOT IN (SELECT main.${StampsHelper.DEFAULT_STAMP_ID} FROM main)
                    OR \`hash\` <> (
                        SELECT \`hash\`
                        FROM main AS B
                        INNER JOIN ${main} AS C
                                ON C.${StampsHelper.DEFAULT_STAMP_ID} = B.${StampsHelper.DEFAULT_STAMP_ID}
                                AND C.${StampsHelper.DEFAULT_STAMP_INSERT} = B.${StampsHelper.DEFAULT_STAMP_INSERT}
                        WHERE B.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                            AND C.${StampsHelper.DEFAULT_STAMP_ID} = temporary.${StampsHelper.DEFAULT_STAMP_ID}
                    )
            `)

    }

}