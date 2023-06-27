import { ObjectHelper } from "./object.helper"
import { TypeHelper } from "./type.helper"

export type Window = {
    begin: Date,
    end: Date
}

export class WindowHelper {

    public static extract(object: any): Window {

        const window = (object.__window ?? {}) as Window
        delete object.__window

        window.begin = ObjectHelper.has(window?.begin) ? TypeHelper.date(window.begin as any) : window?.begin
        window.end = ObjectHelper.has(window?.end) ? TypeHelper.date(window.end as any) : window?.end

        return window

    }

}