import { EnvironmentHelper } from "./environment.helper"

export  type Stamps = {
    id: string,
    insert: string,
    update: string
}

export class StampsHelper {

    public static extract(object: any): Stamps {

        const stamps = (object.__stamps ?? {}) as Stamps
        delete object.__stamps

        stamps.id = stamps.id ?? EnvironmentHelper.get('DEFAULT_STAMP_ID', '_id')
        stamps.insert = stamps.insert ?? EnvironmentHelper.get('DEFAULT_STAMP_INSERT', 'createdAt')
        stamps.update = stamps.update ?? EnvironmentHelper.get('DEFAULT_STAMP_UPDATE', 'updatedAt')

        return stamps

    }
    
}