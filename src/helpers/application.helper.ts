import { Regex } from '../regex'
import { EnvironmentHelper } from './environment.helper'

export class ApplicationHelper {

    private static readonly DEFAULT_PORT = '4000'
    private static readonly DEFAULT_REMOVE_COLLECTIONS = ''
    
    public static get PORT(): number {
        return parseInt(EnvironmentHelper.get('PORT', ApplicationHelper.DEFAULT_PORT))
    }

    public static get REMOVE() {
        
        const COLLECTIONS = 
            EnvironmentHelper.get('REMOVE_COLLECTIONS', ApplicationHelper.DEFAULT_REMOVE_COLLECTIONS)
                .trim()
                .split(',')
                .map(stream => stream.trim())
                .filter(stream => stream)

        return { COLLECTIONS }
    
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