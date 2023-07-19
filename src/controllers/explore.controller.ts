import { CountDocumentsOptions, Document, Filter, FindOptions, ListCollectionsOptions, ListDatabasesOptions, MongoClient, Sort } from 'mongodb'
import { AuthHelper } from '../helpers/auth.helper'
import { MongoDBHelper } from '../helpers/mongodb.helper'
import { ObjectHelper } from '../helpers/object.helper'
import { QueryStringHelper } from '../helpers/querystring.helper'
import { Stamps, StampsHelper } from '../helpers/stamps.helper'
import { StreamHelper } from '../helpers/stream.helper'
import { Window, WindowHelper } from '../helpers/window.helper'
import { Regex, RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse } from '../regex'
import { ExportService } from '../services/export.service'
import { Source, SourceService } from '../services/source.service'

export class ExploreController implements RegexHTTPController {

    public static readonly path = '^/explore'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {

        if (!AuthHelper.validate(request, response)) {
            return
        }

        const input = await _input(request)
        const filter = _filter(input)
        const metadata = await _metadata(input, filter)

        let count = 0

        await _find(input, filter)
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

    }

}

type ExportControllerSource = {
    client: MongoClient,
    name: string
}

type ExportControllerSeachIndexMode = 'offset' | 'page'

type ExportControllerSearchIndex = {
    mode: ExportControllerSeachIndexMode,
    value: number
}

type ExportControllerQueryParameters<T extends Document> = {
    projection: T
    filter: Filter<T>
    sort: Sort
    limit: number
    index: ExportControllerSearchIndex
}

type ExportControllerInput<T extends Document> = {
    source?: ExportControllerSource
    database?: string
    collection?: string
    stamps: Stamps
    window: Window
    now: Date
    parameters: ExportControllerQueryParameters<T>
}

async function _input<T extends Document>(request: HTTPIncomingMessage): Promise<ExportControllerInput<T>> {

    const { searchParams, pathname } = request.getURL()
    const [_, _source, database, collection, hash] = pathname.split('/').filter(value => value)

    const parameters =
        ObjectHelper.has(hash)
            ? QueryStringHelper.parse(Buffer.from(hash, 'base64').toString('utf-8'))
            : QueryStringHelper.parse(searchParams)

    const stamps = StampsHelper.extract(parameters)
    const window = WindowHelper.extract(parameters)

    let source = undefined
    if (ObjectHelper.has(_source)) {
        const service = Regex.inject(SourceService)
        const { url } = await service.find({ name: _source }).next() as Source
        source = { name: _source, client: new MongoClient(url) }
    }

    const now = new Date()

    return { source, database, collection, parameters, stamps, window, now }

}


type ExportControllerFilter<T extends Document> = {
    value: Filter<T>,
    options: ListDatabasesOptions | ListCollectionsOptions | CountDocumentsOptions | FindOptions<T>
}

function _filter<T extends Document>({ parameters, stamps, window, now }: ExportControllerInput<T>): ExportControllerFilter<T> {

    const { projection, filter = {}, sort, limit, index } = parameters
    const options = { projection, sort, limit, skip: _skip({ limit, index }) }

    if (ObjectHelper.has(window.begin)) {
        window.end = window.end ?? now;
        (filter as any).$expr = ExportService.filter(stamps, window).$expr
    }

    const value = (Object.keys(filter).length > 0 ? filter : undefined) as any

    return { value, options }

}

type ExportControllerSkipInput = { limit: number, index: ExportControllerSearchIndex }

function _skip({ limit, index }: ExportControllerSkipInput) {
    const { mode, value } = index
    const _value = value < 0 ? 0 : value
    const result = mode === 'offset' ? _value : limit * _value
    return result
}

async function _metadata<T extends Document>(input: ExportControllerInput<T>, filter: ExportControllerFilter<T>) {

    const count = await _count(input, filter)

    const index =
        input.parameters.index.mode === 'offset'
            ? input.parameters.index.value / input.parameters.limit
            : input.parameters.index.value

    const result: any = { index, count }

    if (ObjectHelper.has(input.database) && ObjectHelper.has(input.collection)) {
        result.previous = await _previous(input, filter, count)
        result.next = await _next(input, filter, count)
    }

    return JSON.stringify(result)

}

function _previous<T extends Document>(input: ExportControllerInput<T>, filter: ExportControllerFilter<T>, count: number) {

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

async function _next<T extends Document>(input: ExportControllerInput<T>, filter: ExportControllerFilter<T>, count: number) {

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

function _token<T extends Document>(parameters: ExportControllerQueryParameters<T>): string {

    (parameters as any).mode = parameters.index.mode
    if (parameters.index.mode === 'offset') {
        (parameters as any).offset = parameters.index.value
    } else {
        (parameters as any).page = parameters.index.value
    }
    delete (parameters as any).index

    return QueryStringHelper.stringify(parameters)

}

async function _count<T extends Document>({ source, database, collection }: ExportControllerInput<T>, filter: ExportControllerFilter<T>): Promise<number> {

    if (!ObjectHelper.has(source)) {
        const service = Regex.inject(SourceService)
        return await service.count(filter.value as Partial<Source>)
    }

    if (!ObjectHelper.has(database) && !ObjectHelper.has(collection)) {
        const databases = await MongoDBHelper.databases({ client: source?.client as MongoClient })
        return databases.length
    }

    if (!ObjectHelper.has(collection)) {
        const collections = await MongoDBHelper.collections({ client: source?.client as MongoClient, database: database as string })
        return collections.length
    }

    if (ObjectHelper.has(database) && ObjectHelper.has(collection)) {
        const { value, options } = filter
        const result = await MongoDBHelper.count({ client: source?.client as MongoClient, database: database as string, collection: collection as string, filter: value as any, options })
        return result
    }

    throw new Error(`database of collection ${collection} must be informed!`)

}

function _find<T extends Document>({ source, database, collection }: ExportControllerInput<T>, filter: ExportControllerFilter<T>) {

    if (!ObjectHelper.has(source)) {
        const service = Regex.inject(SourceService)
        return service
            .find(filter.value as Partial<Source>, { projection: { name: 1, _id: 0 } })
            .map(({ name: source }) => ({ source }))
            .stream()
    }

    if (!ObjectHelper.has(database) && !ObjectHelper.has(collection)) {
        return StreamHelper.create(MongoDBHelper.databases({ client: source?.client as MongoClient }), {
            transform: (stream, databases) =>
                databases.forEach(({ name }) => stream.push({ source: source?.name, database: name }))
        })
    }

    if (!ObjectHelper.has(collection)) {
        return StreamHelper.create(MongoDBHelper.collections({ client: source?.client as MongoClient, database: database as string }), {
            transform: (stream, collections) =>
                collections.forEach(({ dbName: database, collectionName: name }) => stream.push({ source: source?.name, database, name }))
        })
    }

    if (ObjectHelper.has(database) && ObjectHelper.has(collection)) {
        const { value, options } = filter
        return MongoDBHelper.find({ client: source?.client as MongoClient, database: database as string, collection: collection as string, filter: value as any, options }).stream()
    }

    throw new Error(`database of collection ${collection} must be informed!`)

}