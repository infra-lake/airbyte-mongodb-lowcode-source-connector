import { Regex } from '../regex'
import { EnvironmentHelper } from './environment.helper'

export class ApplicationHelper {

    private static readonly DEFAULT_PORT = '4000'
    private static readonly DEFAULT_URL_BASE = 'http://mongodb-exporter-service'
    private static readonly DEFAULT_DOCUMENTATION_URL = 'https://example.org'
    private static readonly DEFAULT_REMOVE_STREAMS = ''
    
    public static get URL() {

        const BASE = EnvironmentHelper.get('URL_BASE', ApplicationHelper.DEFAULT_URL_BASE)

        const DOCUMENTATION = EnvironmentHelper.get('DOCUMENTATION_URL', ApplicationHelper.DEFAULT_DOCUMENTATION_URL)

        return { BASE, DOCUMENTATION }

    }

    public static get PORT(): number {
        return parseInt(EnvironmentHelper.get('PORT', ApplicationHelper.DEFAULT_PORT))
    }

    public static get REMOVE() {
        
        const STREAMS = 
            EnvironmentHelper.get('REMOVE_STREAMS', ApplicationHelper.DEFAULT_REMOVE_STREAMS)
                .trim()
                .split(',')
                .map(stream => stream.trim())
                .filter(stream => stream)

        return { STREAMS }
    
    }

    public static paths() {
        const controllers = Regex.controllers()
        const results = 
            controllers
                .map(({ constructor }) => constructor)
                .map(({ path }) => ({ path }))
        return { metadata: { count: controllers.length }, results }
    }

}