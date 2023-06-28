import qs from 'qs'
import { BadRequestError } from '../exceptions/badrequest.error'
import { DateHelper } from './date.helper'
import { NumberHelper } from './number.helper'

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

                try {
                    const result = DateHelper.parse(input)
                    return result as any
                } catch (error) {
                    throw new BadRequestError(`invalid date: "${text}"`)
                }

            }


            return NumberHelper.parse(value)

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


    public static stringify(object: any): string {
        const result = Buffer.from(qs.stringify(object, {
            encoder: QueryStringHelper.encoder, encodeValuesOnly: true, charset: 'utf-8'
        }), 'utf-8').toString('base64')
        return result
    }

    private static encoder(value: any, defaultEncoder: qs.defaultEncoder, charset: string, type: "value" | "key"): string {

        if (type === 'key') {
            return defaultEncoder(value, QueryStringHelper.encoder, charset)
        }

        if (typeof value === 'string') {
            try {
                const result = NumberHelper.parse(value)
            } catch (error) {
                return `'value'`
            }
        }

        return defaultEncoder(value, charset)

    }

}