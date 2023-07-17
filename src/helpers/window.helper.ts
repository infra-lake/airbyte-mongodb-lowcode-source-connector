import { DateHelper } from './date.helper'
import { ObjectHelper } from './object.helper'

export type Window = {
    begin: Date,
    end: Date
}

export class WindowHelper {

    public static extract(object: any, attribute: string = '__window') {

        const window = (object?.[attribute] ?? {}) as Window
        delete object?.[attribute]

        window.begin = ObjectHelper.has(window?.begin) ? DateHelper.parse(window.begin as any) : window?.begin
        window.end = ObjectHelper.has(window?.end) ? DateHelper.parse(window.end as any) : window?.end

        return window

    }

}