import { EnvironmentHelper } from './environment.helper.mjs'
import { QueryStringHelper } from './querystring.helper.mjs'
import { RegExpIOCHelper } from './regexpioc.helper.mjs'

export class MongoDBHelper {

    static get uri() {

        const protocol = EnvironmentHelper.MONGODB_PROTOCOL
        const host = EnvironmentHelper.MONGODB_HOST
        const port = (EnvironmentHelper?.MONGODB_PORT?.trim() ?? '') === '' ? '' : `:${EnvironmentHelper.MONGODB_PORT.trim()}` 
        const username = EnvironmentHelper.MONGODB_USERNAME
        const password = EnvironmentHelper.MONGODB_PASSWORD
        
        const { transform } = RegExpIOCHelper.inject(QueryStringHelper) 
        const qs =  transform(EnvironmentHelper.MONGODB_QS)
        const uri = `${protocol}://${username}:${password}@${host}${port}${qs}`
        
        return uri
    
    }

}