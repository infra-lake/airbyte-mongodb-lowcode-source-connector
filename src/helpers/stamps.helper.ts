import { EnvironmentHelper } from './environment.helper'

export type Stamps = {
    id: string,
    insert: string,
    update: string,
    limit: string
}

export class StampsHelper {

    public static extract(object: any, attribute: string = '__stamps') {

        const stamps = (object?.[attribute] ?? {}) as Stamps

        delete object?.[attribute]
        
        stamps.id = stamps.id ?? EnvironmentHelper.get('DEFAULT_STAMP_ID', '_id')
        stamps.limit = stamps.limit ?? EnvironmentHelper.get('DEFAULT_STAMP_LIMIT', '1000')
        stamps.insert = stamps.insert ?? EnvironmentHelper.get('DEFAULT_STAMP_INSERT', 'createdAt')
        stamps.update = stamps.update ?? EnvironmentHelper.get('DEFAULT_STAMP_UPDATE', 'updatedAt')

        return stamps

    }

}