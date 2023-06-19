import { CountDocumentsOptions, Document, Filter, FindOptions, MongoClient, Sort } from 'mongodb'
import { Logger, Regex, RegexController, Request, Response } from '../regex'

export class ExportController implements RegexController {

    static path = '^/export'

    public async get(request: Request, response: Response) {

        try {

            // if (!AuthHelper.validate(request)) {
            //     const controller = Regex.inject(NotFoundController)
            //     await controller.handle(request, response)
            //     return
            // }

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

    const { searchParams, pathname } = request.getURL()
    const [_, database, collection, hash] = pathname.split('/').filter(value => value)

    if (hash !== null && hash !== undefined) {
        const parameters = JSON.parse(Buffer.from(hash, 'base64').toString('utf-8'))
        return {
            path: { database, collection },
            parameters
        }
    }

    const sort = _object(searchParams.getAll('sort'))
    const filter = _object(searchParams.getAll('filter'))
    const projection = _object(searchParams.getAll('projection'))

    const limit = parseInt(searchParams.get('limit') ?? '10')

    const mode = (searchParams.get('mode') ?? 'offset') === 'offset' ? 'offset' : 'page'
    const value = parseInt((mode === 'offset' ? searchParams.get('offset') : searchParams.get('page')) ?? '0')

    const parameters: QueryParameters<T> = { projection, filter, sort, limit, index: { mode, value } }
    return { path: { database, collection }, parameters }

}

function _object(array: string[]): any {
    const result = array
        .map(param => param.replace(":","~^").split('~^'))
        .reduce((projection: any, [key, value]) => {

            if (value.startsWith('[') && value.endsWith(']')) {
                const temp = value.substring(1, value.length - 1)
                const inner = temp.match(/\[.*\]/g) ?? []
                if (inner.length > 0) {
                    const outer = inner.map(match => temp.replace(match, '')).flatMap(value => value.split(',').filter(value => value)).map(value => _object([value]))
                    return [...inner.map(_value), ...outer]
                }
                projection[key] = temp.split(',').filter(value => value).map(value => _object([value]))
                return projection
            }

            return key.split('.').reduce((_projection: any, key, index, { length }) => {
                const last = index === (length - 1)
                if (!(key in _projection)) {
                    _projection[key] = last ? _value(value) : {}
                } else if (last) {
                    if (Array.isArray(_projection[key])) {
                        _projection[key].push(_value(value))
                    } else {
                        _projection[key] = [_projection[key], _value(value)]
                    }
                }
                return last ? projection : _projection[key]
            }, projection)
        }, {})
    return Object.keys(result).length > 0 ? result : undefined
}

function _value(value: string): number | string | boolean | Array<any> {
    try {

        if (value.startsWith('"') && value.endsWith('"')) {
            return value.substring(1, value.length - 1)
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
        if (value.startsWith("[") && value.endsWith("]")) {
            const temp = value.substring(1, value.length - 1)
            const inner = temp.match(/\[.*\]/g) ?? []
            if (inner.length > 0) {
                const outer = inner.map(match => temp.replace(match, '')).flatMap(value => value.split(',').filter(value => value)).map(_value)
                return [...inner.map(_value), ...outer]
            }
            return temp.split(',').filter(value => value).map(_value)
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
            ? value ? _token({ projection, filter: _filter, sort, limit, index: { mode: index.mode, value: index.value - limit } }) : null
            : value ? _token({ projection, filter: _filter, sort, limit, index: { mode: index.mode, value: index.value - 1 } }) : null

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
    return Buffer.from(JSON.stringify(parameters), 'utf-8').toString('base64')
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
