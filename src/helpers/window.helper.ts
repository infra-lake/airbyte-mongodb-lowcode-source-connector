export type Window = {
    begin: any,
    end: any
}

export class WindowHelper {

    public static extract(object: any): Window {

        const window = (object.__window ?? {}) as Window
        delete object.__window

        return window

    }

}