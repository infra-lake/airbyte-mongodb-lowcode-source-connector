import { CountDocumentsOptions, Document, Filter, FindOptions, ListCollectionsOptions, ListDatabasesOptions, MongoClient, Sort } from 'mongodb'
import qs from 'qs'
import Stream from 'stream'
import { BadRequestError } from '../exceptions/badrequest.error'
import { AuthHelper } from '../helpers/auth.helper'
import { Logger, Regex, RegexController, Request, Response } from '../regex'
import { NotFoundController } from './notfound.controller'

export class ExportController implements RegexController {

    static path = '^/export'

    public async get(request: Request, response: Response) {

        try {

            if (!AuthHelper.validate(request, response)) {
                return
            }

            const input = _input(request)
            const filter = _filter(input)
            const metadata = await _metadata(input, filter)

            let count = 0

            const result = _find(input, filter)
                .on('resume', () => {
                    response.setHeader('Content-Type', 'application/json')
                    response.write(`{ "metadata": ${metadata}, "results": [`)
                    response.setStatusCode(200)
                })
                .on('data', chunk => {
                    if (++count > 1) {
                        response.write(',')
                    }
                    response.write(JSON.stringify(chunk))
                })
                .on('end', () => {
                    response.write('] }')
                    response.end()
                })
                .on('error', (error) => {
                    console.error('error:', error)
                    response.setStatusCode(500)
                    response.end()
                })

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

type Path = {
    database?: string
    collection?: string
}
type SeachIndexMode = 'offset' | 'page'
type SearchIndex = {
    mode: SeachIndexMode,
    value: number
}
type QueryParameters<T extends Document> = {
    projection: T
    filter: Filter<T>
    sort: Sort
    limit: number
    index: SearchIndex
}
type ExporterInput<T extends Document> = {
    path: Path
    parameters: QueryParameters<T>
}
function _input<T extends Document>(request: Request): ExporterInput<T> {

    const { searchParams, pathname, } = request.getURL()
    const [_, database, collection, hash] = pathname.split('/').filter(value => value)

    const parameters =
        hash !== null && hash !== undefined
            ? _parameters(Buffer.from(hash, 'base64').toString('utf-8'))
            : _parameters(searchParams.toString())

    return { path: { database, collection }, parameters }

}

function _parameters(value: string): any {

    const parameters = qs.parse(value, { decoder: _decoder, charset: 'utf-8' }) as any

    parameters.limit = parameters.limit ?? 10

    parameters.mode = parameters.mode ?? 'offset'

    parameters.index =
        parameters.mode === 'offset'
            ? { mode: 'offset', value: parameters.offset ?? 0 }
            : { mode: 'page', value: parameters.page ?? 0 }

    delete parameters.mode
    delete parameters.offset
    delete parameters.page

    return parameters

}

function _decoder(value: string, defaultDecoder: qs.defaultDecoder, charset: string, type: 'key' | 'value'): number | string | boolean | Array<any> {

    try {

        if (type === 'key') {
            return defaultDecoder(value, _decoder, charset)
        }

        if ((value.startsWith('\'') && value.endsWith('\'')) ||
            (value.startsWith('"') && value.endsWith('"'))) {
            const result = value.substring(1, value.length - 1)
            return defaultDecoder(result, _decoder, charset)
        }

        if ((value.startsWith('%22') && value.endsWith('%22')) ||
            (value.startsWith('%27') && value.endsWith('%27'))) {
            const result = value.substring(3, value.length - 3)
            return defaultDecoder(result, _decoder, charset)
        }

        if ((value.startsWith('ISODate'))) {
            const text = defaultDecoder(value, _decoder, charset)
            const input = text.substring('ISODate'.length + 2, text.length - 2)
            const model = '0000-00-00T00:00:00.000Z'
            if (input.length > model.length) {
                throw new BadRequestError(`invalid date: "${text}"`)
            }
            try {
                const result = new Date(`${input}${model.substring(input.length)}`)
                return result as any
            } catch (error) {
                throw new BadRequestError(`invalid date: "${text}"`)
            }
        }

        const result = Number(value)
        if (Number.isNaN(result)) {
            throw new Error(`invalid number: "${defaultDecoder(value, _decoder, charset)}"`)
        }

        return result

    } catch (error) {

        if (error instanceof BadRequestError) {
            throw error
        }

        if (value.trim() === "true" || value.trim() === "false") {
            return value.trim() === "true"
        }

        return defaultDecoder(value, _decoder, charset)

    }

}

type ExportFilter<T extends Document> = {
    value: Filter<T>,
    options: ListDatabasesOptions | ListCollectionsOptions | CountDocumentsOptions | FindOptions<T>
}
function _filter<T extends Document>({ parameters }: ExporterInput<T>): ExportFilter<T> {
    const { projection, filter, sort, limit, index } = parameters
    const options = { projection, sort, limit, skip: _skip({ limit, index }) }
    return { value: filter, options }
}

type SkipInput = { limit: number, index: SearchIndex }
function _skip({ limit, index }: SkipInput) {
    const { mode, value } = index
    const _value = value < 0 ? 0 : value
    const result = mode === 'offset' ? _value : limit * _value
    return result
}

async function _metadata<T extends Document>(input: ExporterInput<T>, filter: ExportFilter<T>) {

    const count = await _count(input, filter)

    const index =
        input.parameters.index.mode === 'offset'
            ? input.parameters.index.value / input.parameters.limit
            : input.parameters.index.value

    const result: any = { index, count }

    if (input.path.database !== null && input.path.database !== undefined &&
        input.path.collection !== null && input.path.collection !== undefined) {
        result.previous = await _previous(input, filter, count)
        result.next = await _next(input, filter, count)
    }

    return JSON.stringify(result)

}

function _previous<T extends Document>(input: ExporterInput<T>, filter: ExportFilter<T>, count: number) {

    const { parameters } = input
    const { projection, filter: _filter, sort, limit, index } = parameters

    const value =
        count < 0
            ? false
            : ((filter?.options as any)?.skip ?? 0) > 0

    const token =
        index.mode === 'offset'
            ? value
                ? _token({
                    projection,
                    filter: _filter,
                    sort,
                    limit,
                    index: {
                        mode: index.mode,
                        value: (index.value - limit) < 0 ? 0 : (index.value - limit)
                    }
                })
                : null
            : value
                ? _token({
                    projection,
                    filter: _filter,
                    sort,
                    limit,
                    index: {
                        mode: index.mode,
                        value: (index.value - 1) < 0 ? 0 : (index.value - 1)
                    }
                })
                : null

    return { value, token }

}

async function _next<T extends Document>(input: ExporterInput<T>, filter: ExportFilter<T>, count: number) {

    const { parameters } = input
    const { projection, filter: _filter, sort, limit, index } = parameters

    const value =
        count < limit
            ? false
            : await _count(input, { ...filter, options: { ...filter.options, limit: 1, skip: limit + ((filter?.options as any)?.skip ?? 0) } }) > 0

    const token =
        index.mode === 'offset'
            ? value ? _token({ projection, filter: _filter, sort, limit, index: { mode: index.mode, value: index.value + limit } }) : null
            : value ? _token({ projection, filter: _filter, sort, limit, index: { mode: index.mode, value: index.value + 1 } }) : null

    return { value, token }

}

function _token<T extends Document>(parameters: QueryParameters<T>): string {

    (parameters as any).mode = parameters.index.mode
    if (parameters.index.mode === 'offset') {
        (parameters as any).offset = parameters.index.value
    } else {
        (parameters as any).page = parameters.index.value
    }
    delete (parameters as any).index

    return Buffer.from(qs.stringify(parameters, { encoder: _encoder, encodeValuesOnly: true, charset: 'utf-8' }), 'utf-8').toString('base64')
}

function _encoder(value: any, defaultEncoder: qs.defaultEncoder, charset: string, type: "value" | "key"): string {

    if (type === 'key') {
        return defaultEncoder(value, _encoder, charset)
    }

    if (typeof value === 'string') {
        const result = Number(value)
        if (!Number.isNaN(result)) {
            return `'${value}'`
        }

    }

    return defaultEncoder(value, charset)

}

async function _count<T extends Document>({ path }: ExporterInput<T>, filter: ExportFilter<T>): Promise<number> {

    const mongodb = Regex.inject(MongoClient)
    const { database, collection } = path

    if ((database === null || database === undefined) &&
        (collection === null || collection === undefined)) {
        const { options } = filter
        const result = await mongodb.db().admin().listDatabases(options)
        return result.databases.length
    }

    if (collection === null || collection === undefined) {
        const { options } = filter
        const result = await mongodb.db(database).collections(options)
        return result.length
    }

    if (database !== null && database !== undefined &&
        collection !== null && collection !== undefined &&
        filter !== null && filter !== undefined) {
        const { value, options } = filter
        const result = await mongodb.db(database).collection(collection).countDocuments(value, options)
        return result
    }

    throw new Error(`database of collection ${collection} must be informed!`)

}

function _find<T extends Document>({ path }: ExporterInput<T>, filter: ExportFilter<T>) {

    const mongodb = Regex.inject(MongoClient)
    const { database, collection } = path

    if ((database === null || database === undefined) &&
        (collection === null || collection === undefined)) {
        const { options } = filter
        const stream = new Stream.Readable({ read() { }, objectMode: true })
        mongodb.db().admin().listDatabases(options)
            .then(result => result.databases.forEach(({ name }) => stream.push({ name })))
            .catch(error => stream.destroy(error))
            .finally(() => stream.push(null))
        return stream
    }

    if (collection === null || collection === undefined) {
        const { options } = filter
        const stream = new Stream.Readable({ read() { }, objectMode: true })
        mongodb.db(database).collections(options)
            .then(collections => collections.forEach(({ dbName, collectionName }) => stream.push({ database: dbName, name: collectionName })))
            .catch(error => stream.destroy(error))
            .finally(() => stream.push(null))
        return stream
    }

    if (database !== null && database !== undefined &&
        collection !== null && collection !== undefined &&
        filter !== null && filter !== undefined) {
        const { value, options } = filter
        return mongodb.db(database).collection(collection).find(value as T, options).stream()
    }

    throw new Error(`database of collection ${collection} must be informed!`)

}
