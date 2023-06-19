import { randomUUID } from 'crypto'
import { RegexController } from './app'

export enum RegexField {
    ID = '__regex_ioc_id',
    REGEX = '__regex_ioc_regex',
    TYPE = '__regex_ioc_type',
    MULTIPLE = '__regex_ioc_multiple'
}

export type RegexClass<T> = new (...args: any[]) => T
export type RegexpKey<T> = string | RegexClass<T>

export type RegexControler<T extends RegexController> = RegexClass<T> & { path: string }

export class Regex {

    private static instances: { [key: string]: any } = {}

    public static inject<T>(key: RegexpKey<T>): T {

        const text: string =
            typeof key === 'string'
                ? key
                : (key as any).regex ?? key.name

        const instances =
            Object
                .keys(Regex.instances)
                .filter(regex => text.match(regex))
                .map(key => Regex.instances[key])

        const result =
            instances.length > 1
                ? instances
                : instances.length
                    ? instances[0]
                    : undefined

        if (result.length > 1 && !result[RegexField.MULTIPLE]) {
            throw Error(`there are two instances competing to regex ${text}, but all instances are not allowed to be multiple`)
        }

        return result

    }

    public static controller<T extends RegexController>(controller: RegexControler<T>, ...args: any[]): T {

        const type = controller as any

        if (Regex.marked(type)) {
            return Regex.instances[type[RegexField.REGEX]]
        }

        type[RegexField.ID] = `${type.name}-${randomUUID()}-${new Date().getTime()}`
        type[RegexField.REGEX] = type.path
        type[RegexField.MULTIPLE] = false
        type[RegexField.TYPE] = type.name
        type[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]

        const instance: any = new type(...args)
        instance[RegexField.ID] = type[RegexField.ID]
        instance[RegexField.REGEX] = type[RegexField.REGEX]
        instance[RegexField.TYPE] = type[RegexField.TYPE]
        instance[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]

        if (!Regex.exists(type[RegexField.REGEX] as string)) {
            Regex.instances[type[RegexField.REGEX] as string] = instance
        } else {
            throw Error(`there are two controllers competing to the same path ${type[RegexField.REGEX]}`)
        }

        return Regex.instances[type[RegexField.REGEX] as string]


    }

    public static register<T>(clazz: RegexClass<T>, ...args: any): T {

        if ('path' in clazz &&
            clazz.name.endsWith('Controller') &&
            Object.keys(clazz).filter(key => ['get', 'post', 'put', 'delete', 'patch', 'handle'].includes(key)).length > 0) {
            return Regex.controller(clazz as any, ...args) as T
        }

        const type = clazz as any

        if (Regex.marked(type) && !Regex.random(type)) {
            return Regex.instances[type[RegexField.REGEX]]
        }

        type[RegexField.ID] = `${type.name}-${randomUUID()}-${new Date().getTime()}`

        type[RegexField.REGEX] =
            type.regex === '{random}'
                ? `^${type[RegexField.ID]}$`
                : type.regex ?? `^${type.name}$`

        type[RegexField.TYPE] = type.name
        type[RegexField.MULTIPLE] = type[RegexField.MULTIPLE] ?? false

        const instance: any = new type(...args)
        instance[RegexField.ID] = type[RegexField.ID]
        instance[RegexField.REGEX] = type[RegexField.REGEX]
        instance[RegexField.TYPE] = type[RegexField.TYPE]
        instance[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]

        if (!Regex.exists(type[RegexField.REGEX] as string)) {
            Regex.instances[type[RegexField.REGEX] as string] = instance
        } else if (Array.isArray(Regex.instances[type[RegexField.REGEX] as string]) && instance[RegexField.MULTIPLE]) {
            Regex.instances[type[RegexField.REGEX] as string].push(instance)
        } else if (Regex.instances[type[RegexField.REGEX] as string][RegexField.MULTIPLE] && instance[RegexField.MULTIPLE]) {
            Regex.instances[type[RegexField.REGEX] as string] = [Regex.instances[type[RegexField.REGEX] as string], instance]
        } else {
            throw Error(`there are two instances competing to regex ${instance[RegexField.REGEX]}, but all instances are not allowed to be multiple`)
        }

        return Regex.instances[type[RegexField.REGEX] as string]

    }

    private static marked(object: any): boolean {
        return RegexField.REGEX in object && object[RegexField.REGEX] !== null && object[RegexField.REGEX] !== undefined &&
            RegexField.ID in object && object[RegexField.ID] !== null && object[RegexField.ID] !== undefined &&
            RegexField.TYPE in object && object[RegexField.TYPE] !== null && object[RegexField.TYPE] !== undefined &&
            RegexField.MULTIPLE in object && object[RegexField.MULTIPLE] !== null && object[RegexField.MULTIPLE] !== undefined
    }

    private static exists(stamp: string): boolean {
        return stamp in Regex && Regex.instances[stamp] !== null && Regex.instances[stamp] !== undefined
    }

    private static random(object: any): boolean {
        return 'id' in object && object.regex === '{random}'
    }

    public static unregister<T>(key: RegexpKey<T> | any) {

        const text: string =
            typeof key === 'string'
                ? key
                : RegexField.REGEX in key
                    ? key[RegexField.REGEX] ?? (key as any).regex ?? key.name
                    : (key as any).regex ?? key.name

        Object
            .keys(Regex.instances)
            .filter(regex => text.match(regex))
            .forEach(key => delete Regex.instances[key])

    }

}