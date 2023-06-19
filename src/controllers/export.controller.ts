import { CountDocumentsOptions, Document, Filter, FindOptions, MongoClient, Sort } from 'mongodb'
import qs from 'qs'
import { Logger, Regex, RegexController, Request, Response } from '../regex'

export class ExportController implements RegexController {

    static path = '^/export'

    public async get(request: Request, response: Response) {

        try {

            if (!AuthHelper.validate(request)) {
                const controller = Regex.inject(NotFoundController)
                await controller.handle(request, response)
                return
            }

            const input = _input(request)
            const filter = _filter(input)
            const metadata = await _metadata(input, filter)

            let count = 0
            _find(input, filter)
                .on('resume', () => {
                    response.setHeader('Content-Type', 'application/json')
                    response.write(`{ "metadata": ${metadata}, "results": [`)
                    response.statusCode = 200
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
                    response.statusCode = 500
                    response.end()
                })

        } catch (error) {
            const logger = Logger.from(request)
            logger.error('error:', error)
            response.statusCode = 500
            response.end()
        }

    }

}

type Path = {
    database: string
    collection: string
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

        if (value.startsWith('\'') && value.endsWith('\'')) {
            return value.substring(1, value.length - 1)
        }

        if (value.startsWith('"') && value.endsWith('"')) {
            return value.substring(1, value.length - 1)
        }

        if (value.includes('%22')) {
            return value.replaceAll('%22', '')
        }

        if (value.includes('%27')) {
            return value.replaceAll('%27', '')
        }

        const result = Number(value)
        if (Number.isNaN(result)) {
            throw new Error()
        }

        return result

    } catch (error) {

        if (value.trim() === "true" || value.trim() === "false") {
            return value.trim() === "true"
        }

        return value
    }

}

type ExportFilter<T extends Document> = {
    value: Filter<T>,
    options: CountDocumentsOptions | FindOptions<T>
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
    const previous = await _previous(input, filter, count)
    const next = await _next(input, filter, count)

    return JSON.stringify({ index, count, previous, next })

}

function _previous<T extends Document>(input: ExporterInput<T>, filter: ExportFilter<T>, count: number) {

    const { parameters } = input
    const { projection, filter: _filter, sort, limit, index } = parameters

    const value =
        count < 0
            ? false
            : (filter.options.skip ?? 0) > 0

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
            : await _count(input, { ...filter, options: { ...filter.options, limit: 1, skip: limit + (filter.options.skip ?? 0) } }) > 0

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

async function _count<T extends Document>({ path }: ExporterInput<T>, { value, options }: ExportFilter<T>): Promise<number> {
    const mongodb = Regex.inject(MongoClient)
    const { database, collection } = path
    const result = await mongodb.db(database).collection(collection).countDocuments(value, options)
    return result
}

function _find<T extends Document>({ path }: ExporterInput<T>, { value, options }: ExportFilter<T>) {
    const mongodb = Regex.inject(MongoClient)
    const { database, collection } = path
    return mongodb.db(database).collection(collection).find(value as T, options).stream()
}
