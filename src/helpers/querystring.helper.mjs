import { RegExpIOCHelper } from './regexpioc.helper.mjs'

export class QueryStringHelper {

    transform(value) {

        if ((value?.trim() ?? '') === '') {
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

}

RegExpIOCHelper.register(QueryStringHelper)