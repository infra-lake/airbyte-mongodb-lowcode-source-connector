import { randomUUID } from 'crypto'

export class RegExpIOCHelper {

    static #instances = {}

    static get id() { return '__regex_ioc_id' }
    static get stamp() { return '__regex_ioc_regex' }
    static get type() { return '__regex_ioc_type' }
    static get multiple() { return '__regex_ioc_multiple' }

    static inject(key) {

        const text =
            typeof key === 'string'
                ? key
                : key.regex ?? key.name

        const instances =
            Object
                .keys(RegExpIOCHelper.#instances)
                .filter(regex => text.match(regex))
                .map(key => RegExpIOCHelper.#instances[key])

        const result =
            instances.length > 1
                ? instances
                : instances.length
                    ? instances[0]
                    : undefined

        return result

    }

    static register(type, ...args) {

        if (type[RegExpIOCHelper.id] && type.id !== '{random}') {
            return RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]]
        }

        type[RegExpIOCHelper.id] = `${type.name}-${randomUUID()}-${new Date().getTime()}`

        type[RegExpIOCHelper.stamp] =
            type.name.endsWith('Controller')
                ? type.path
                : type.id === '{random}'
                    ? type[RegExpIOCHelper.id]
                    : type.id ?? type.name

        if (type.name.endsWith('Controller')) {
            type[RegExpIOCHelper.multiple] = false
        }

        type[RegExpIOCHelper.type] = type.name
        type[RegExpIOCHelper.multiple] = type[RegExpIOCHelper.multiple] ?? false

        const instance = new type(...args)
        instance[RegExpIOCHelper.id] = type[RegExpIOCHelper.id]
        instance[RegExpIOCHelper.stamp] = type[RegExpIOCHelper.stamp]
        instance[RegExpIOCHelper.type] = type.name
        instance[RegExpIOCHelper.multiple] = type[RegExpIOCHelper.multiple]

        if (!RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]]) {
            RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]] = instance
        } else if (Array.isArray(RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]]) && instance[RegExpIOCHelper.multiple]) {
            RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]].push(instance)
        } else if (RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]][RegExpIOCHelper.multiple] && instance[RegExpIOCHelper.multiple]) {
            RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]] = [RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]], instance]
        } else {
            throw Error('there are two instances competing to type', type.name, ', but all instances are not allowed to be multiple')
        }

        return RegExpIOCHelper.#instances[type[RegExpIOCHelper.stamp]]

    }

    static unregister(key) {

        const text =
            typeof key === 'string'
                ? key
                : key[RegExpIOCHelper.stamp] ?? key.regex ?? key.name

        Object
            .keys(RegExpIOCHelper.#instances)
            .filter(regex => text.match(regex))
            .forEach(key => delete RegExpIOCHelper.#instances[key])

    }

}