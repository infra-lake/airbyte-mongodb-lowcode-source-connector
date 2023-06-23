import qs from 'qs'
import { Request } from '../regex'
import { BadRequestError } from '../exceptions/badrequest.error'

export class QueryStringHelper {

    public static transform(value: string) {

        if (value.trim() === '') {
            return ''
        }

        const qs = value
            .trim()
            .split(',')
            .filter(property => (property?.trim() ?? '') !== '')
            .map(property => property.replace(/\:/g, '='))
            .reduce((qs, property) => qs ? `${property}&${qs}` : property)

        return `?${qs}`

    }

    public static parse(value: URLSearchParams | string): any {

        if (typeof value !== 'string') {
            return QueryStringHelper.parse(value.toString())
        }

        const parameters = qs.parse(value, { decoder: QueryStringHelper.decoder, charset: 'utf-8' }) as any

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

    private static decoder(value: string, defaultDecoder: qs.defaultDecoder, charset: string, type: 'key' | 'value'): number | string | boolean | Array<any> {

        try {

            if (type === 'key') {
                return defaultDecoder(value, QueryStringHelper.decoder, charset)
            }

            if ((value.startsWith('\'') && value.endsWith('\'')) ||
                (value.startsWith('"') && value.endsWith('"'))) {
                const result = value.substring(1, value.length - 1)
                return defaultDecoder(result, QueryStringHelper.decoder, charset)
            }

            if ((value.startsWith('%22') && value.endsWith('%22')) ||
                (value.startsWith('%27') && value.endsWith('%27'))) {
                const result = value.substring(3, value.length - 3)
                return defaultDecoder(result, QueryStringHelper.decoder, charset)
            }

            if ((value.startsWith('ISODate'))) {

                const text = defaultDecoder(value, QueryStringHelper.decoder, charset)
                const input = text.substring('ISODate'.length + 2, text.length - 2)
                
                const model = '0000-01-01T00:00:00.000Z'

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
                throw new Error(`invalid number: "${defaultDecoder(value, QueryStringHelper.decoder, charset)}"`)
            }

            return result

        } catch (error) {

            if (error instanceof BadRequestError) {
                throw error
            }

            if (value.trim() === "true" || value.trim() === "false") {
                return value.trim() === "true"
            }

            return defaultDecoder(value, QueryStringHelper.decoder, charset)

        }

    }

}