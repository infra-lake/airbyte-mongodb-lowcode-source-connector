import { randomUUID } from 'crypto'

export enum RegexField {
    ID = '__regex_ioc_id',
    STAMP = '__regex_ioc_regex',
    TYPE = '__regex_ioc_type',
    MULTIPLE = '__regex_ioc_multiple'
}

export type RegexClass<T> = new(...args: any[]) => T
export type RegexpKey<T> = string | RegexClass<T>

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

        return result

    }

    public static register<T>(clazz: RegexClass<T>, ...args: any): T {

        const type = clazz as any

        if (Regex.marked(type) && !Regex.random(type)) {
            return Regex.instances[type[RegexField.STAMP]]
        }

        type[RegexField.ID] = `${type.name}-${randomUUID()}-${new Date().getTime()}` as string

        type[RegexField.STAMP] =
            type.name.endsWith('Controller')
                ? type.path
                : type.id === '{random}'
                    ? type[RegexField.ID]
                    : type.id ?? type.name

        if (type.name.endsWith('Controller')) {
            type[RegexField.MULTIPLE] = false
        }

        type[RegexField.TYPE] = type.name as string
        type[RegexField.MULTIPLE] = type[RegexField.MULTIPLE] ?? false

        const instance: any = new type(...args)
        instance[RegexField.ID] = type[RegexField.ID]
        instance[RegexField.STAMP] = type[RegexField.STAMP]
        instance[RegexField.TYPE] = type.name
        instance[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]

        if (!Regex.exists(type[RegexField.STAMP] as string)) {
            Regex.instances[type[RegexField.STAMP] as string] = instance
        } else if (Array.isArray(Regex.instances[type[RegexField.STAMP] as string]) && instance[RegexField.MULTIPLE]) {
            Regex.instances[type[RegexField.STAMP] as string].push(instance)
        } else if (Regex.instances[type[RegexField.STAMP] as string][RegexField.MULTIPLE] && instance[RegexField.MULTIPLE]) {
            Regex.instances[type[RegexField.STAMP] as string] = [Regex.instances[type[RegexField.STAMP] as string], instance]
        } else {
            throw Error(`there are two instance competing to type ${type.name}, but all instances are not allowed to be multiple`)
        }

        return Regex.instances[type[RegexField.STAMP] as string]

    }

    private static marked(object: any): boolean {
        return RegexField.STAMP in object && object[RegexField.STAMP] !== null && object[RegexField.STAMP] !== undefined && 
                RegexField.ID in object && object[RegexField.ID] !== null && object[RegexField.ID] !== undefined &&
                RegexField.TYPE in object && object[RegexField.TYPE] !== null && object[RegexField.TYPE] !== undefined &&
                RegexField.MULTIPLE in object && object[RegexField.MULTIPLE] !== null && object[RegexField.MULTIPLE] !== undefined
    } 

    private static exists(stamp: string): boolean {
        return stamp in Regex && Regex.instances[stamp] !== null && Regex.instances[stamp] !== undefined
    }

    private static random(object: any): boolean {
        return 'id' in object && object.id === '{random}'
    } 

    public static unregister<T>(key: RegexpKey<T> | any) {

        const text: string =
            typeof key === 'string'
                ? key
                : RegexField.STAMP in key 
                    ? key[RegexField.STAMP] ?? (key as any).regex ?? key.name
                    : (key as any).regex ?? key.name

        Object
            .keys(Regex.instances)
            .filter(regex => text.match(regex))
            .forEach(key => delete Regex.instances[key])

    }

}