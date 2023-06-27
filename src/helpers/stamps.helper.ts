import { EnvironmentHelper } from './environment.helper'

export type Stamps = {
    id: string,
    insert: string,
    update: string,
    limit: string
}

export class StampsHelper {

    public static extract(object: any): Stamps {

        const stamps = (object.__stamps ?? {}) as Stamps

        delete object.__stamps
        
        stamps.id = stamps.id ?? EnvironmentHelper.get('DEFAULT_STAMPS_ID', '_id')
        stamps.limit = stamps.limit ?? EnvironmentHelper.get('DEFAULT_STAMPS_LIMIT', '1000')
        stamps.insert = stamps.insert ?? EnvironmentHelper.get('DEFAULT_STAMPS_INSERT', 'createdAt')
        stamps.update = stamps.update ?? EnvironmentHelper.get('DEFAULT_STAMPS_UPDATE', 'updatedAt')

        return stamps

    }

}