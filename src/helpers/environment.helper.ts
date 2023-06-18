import dotenv from 'dotenv'
import fs from 'fs'
import { QueryStringHelper } from './querystring.helper'

export class EnvironmentHelper {

    private static configured = false

    public static get<T extends string | undefined>(name: string, _default?: T, transform?: (result: T) => T): T extends string ? string : undefined {
        const environment = process.env[name]?.trim() ?? _default
        const result = transform !== null && transform !== undefined ? transform(environment as T) : environment
        return result as T extends string ? string : undefined
    }

    public static set(name: string, value: string) {
        process.env[name] = value.trim()
    }

    public static config() {

        if (this.configured) {
            return
        }

        dotenv.config()

        const { name, version, description } = JSON.parse(fs.readFileSync('package.json').toString())
        EnvironmentHelper.set('PROJECT_NAME', name)
        EnvironmentHelper.set('PROJECT_VERSION', version)
        EnvironmentHelper.set('PROJECT_DESCRIPTION', description)

        if (EnvironmentHelper.get('MONGODB_URI', '') === '') {

            const protocol = EnvironmentHelper.get('MONGODB_PROTOCOL')
            const host = EnvironmentHelper.get('MONGODB_HOST')
            const port = EnvironmentHelper.get('MONGODB_PORT', '', result => result === '' ? '' : `:${result}`)
            const username = EnvironmentHelper.get('MONGODB_USERNAME')
            const password = EnvironmentHelper.get('MONGODB_PASSWORD')

            const qs = QueryStringHelper.transform(EnvironmentHelper.get('MONGODB_QS', ''))

            EnvironmentHelper.set('MONGODB_URI', `${protocol}://${username}:${password}@${host}${port}${qs}`)
        
        }

        this.configured = true

    }

}