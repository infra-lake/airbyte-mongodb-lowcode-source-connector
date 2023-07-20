import { randomUUID } from 'crypto'
import { ObjectHelper } from '../helpers/object.helper'
import { RegexHTTPController } from './http'
import { RegexRabbitMQController } from './rabbitmq'

export enum RegexField {
    ID = '__regex_ioc_id',
    REGEX = '__regex_ioc_regex',
    TYPE = '__regex_ioc_type',
    MULTIPLE = '__regex_ioc_multiple',
    CONTROLLER = '__regex_ioc_controller'
}

export type RegexClass<T> = new (...args: any[]) => T
export type RegexKey<T> = string | RegexClass<T>

export type RegexHTTPControllerClass<T extends RegexHTTPController> = RegexClass<T> & { path: string }
export type RegexAMQPControllerClass<T extends RegexRabbitMQController> = RegexClass<T> & { pattern: string }

export type RegexAMQPControllerClassType = 'http' | 'rabbitmq'
export type RegexAMQPClassType = 'service' | RegexAMQPControllerClassType

export class Regex {
    
    private static readonly instances: { [key: string]: any } = {}

    public static controllers(type?: RegexAMQPControllerClassType) {
        const result = 
            Object
                .keys(this.instances)
                .filter(key => this.instances[key][RegexField.CONTROLLER])
                .filter(key => this.instances[key][RegexField.CONTROLLER] === type || !ObjectHelper.has(type))
                .map(key => this.instances[key])
        return result
    }

    public static inject<T>(key: RegexKey<T>, type?: RegexAMQPClassType): T {

        const text: string =
            typeof key === 'string'
                ? key
                : (key as any)[RegexField.REGEX]

        const instances =
            Object
                .keys(Regex.instances)
                .filter(regex => {

                    const instance = Regex.instances[regex]

                    if (!ObjectHelper.has(type)) {
                        return true
                    }

                    if (type === 'service') {
                        return instance[RegexField.CONTROLLER] === false
                    }

                    return instance[RegexField.CONTROLLER] === type

                })
                .filter(regex => text.match(regex) ?? text === regex)
                .flatMap(key => Regex.instances[key])
        
        const result =
            instances.length > 1
                ? instances
                : instances.length
                    ? instances[0]
                    : undefined

        if (Array.isArray(result) && result.length > 1 && result.filter(instance => instance[RegexField.MULTIPLE]).length < 0) {
            throw Error(`there are two instances competing to regex ${text}, but all instances are not allowed to be multiple`)
        }

        return result

    }

    public static controller<T extends RegexHTTPController | RegexRabbitMQController | undefined>(_controller: T extends RegexHTTPController ? RegexHTTPControllerClass<T> : T extends RegexRabbitMQController ? RegexAMQPControllerClass<T> : undefined, ...args: any[]): T {

        if (!ObjectHelper.has(_controller)) {
            return undefined as T
        }

        const type = _controller as any

        if (Regex.marked(type)) {
            return Regex.instances[type[RegexField.REGEX]]
        }

        type[RegexField.ID] = `${type.name}-${randomUUID()}-${new Date().getTime()}`
        type[RegexField.REGEX] = 'path' in type ? type.path : type.pattern
        type[RegexField.MULTIPLE] = true
        type[RegexField.TYPE] = type.name
        type[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]
        type[RegexField.CONTROLLER] = 'path' in type ? 'http' : 'rabbitmq'

        const instance: any = new type(...args)
        instance[RegexField.ID] = type[RegexField.ID]
        instance[RegexField.REGEX] = type[RegexField.REGEX]
        instance[RegexField.TYPE] = type[RegexField.TYPE]
        instance[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]
        instance[RegexField.CONTROLLER] = type[RegexField.CONTROLLER]

        if (!Regex.exists(type[RegexField.REGEX] as string)) {
            Regex.instances[type[RegexField.REGEX] as string] = instance
        } else if (Array.isArray(Regex.instances[type[RegexField.REGEX] as string])) {
            Regex.instances[type[RegexField.REGEX] as string].push(instance)
        } else if (Regex.instances[type[RegexField.REGEX] as string][RegexField.MULTIPLE]) {
            Regex.instances[type[RegexField.REGEX] as string] = [Regex.instances[type[RegexField.REGEX] as string], instance]
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
                ? type[RegexField.ID]
                : type.regex ?? `^${type.name}$`

        type[RegexField.TYPE] = type.name
        type[RegexField.MULTIPLE] = type[RegexField.MULTIPLE] ?? false
        type[RegexField.CONTROLLER] = false

        const instance: any = new type(...args)
        instance[RegexField.ID] = type[RegexField.ID]
        instance[RegexField.REGEX] = type[RegexField.REGEX]
        instance[RegexField.TYPE] = type[RegexField.TYPE]
        instance[RegexField.MULTIPLE] = type[RegexField.MULTIPLE]
        instance[RegexField.CONTROLLER] = type[RegexField.CONTROLLER]

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

        const result =
            ObjectHelper.has(object?.[RegexField.REGEX]) &&
            ObjectHelper.has(object?.[RegexField.ID]) &&
            ObjectHelper.has(object?.[RegexField.TYPE]) &&
            ObjectHelper.has(object?.[RegexField.MULTIPLE])

        return result
    }

    private static exists(stamp: string): boolean {
        return ObjectHelper.has(Regex.instances?.[stamp])
    }

    private static random(object: any): boolean {
        return 'regex' in object && object.regex === '{random}'
    }

    public static unregister<T>(key: RegexKey<T> | any) {

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