import { ObjectId } from "mongodb"
import { DateHelper } from "./date.helper"
import { ObjectHelper } from "./object.helper"
import { Stamps } from "./stamps.helper"
import { Window } from "./window.helper"

export type OutputInput = {
    database: string,
    collection: string,
    stamps: Stamps,
    window?: Window,
    now?: Date
}

export class ExporterHelper {

    public static output(chunk: any, { database, collection, stamps, window, now }: OutputInput) {

        const _now = now ?? new Date()

        if (!ObjectHelper.has(database) || !ObjectHelper.has(collection)) {
            return chunk
        }

        const { insert, update, id } = stamps

        chunk[insert] = chunk[insert] ?? _date(chunk[id], window?.begin ?? _now)
        chunk[update] = chunk[update] ?? chunk[insert]

        chunk[insert] = DateHelper.stringify(chunk[insert])
        chunk[update] = DateHelper.stringify(chunk[update])

        const result = _fix(chunk)

        return result

    }

}

function _date(input: string, _default: Date) {
    try {
        return new ObjectId(input).getTimestamp()
    } catch (error) {
        if (_default) {
            return _default
        }
        throw error
    }
}

function _fix(object: any): any {

    if (!ObjectHelper.has(object)) {
        return object
    }

    if (Array.isArray(object)) {
        object.forEach(_fix)
        return object
    }

    if (typeof object === 'object') {

        Object.keys(object).forEach(key => {

            if (key.trim() === '') {
                const value = object[key]
                delete object[key]
                object['__empty__'] = _fix(value)
                return
            }

            object[key] = _fix(object[key])

        })

        return object

    }

    return object

}