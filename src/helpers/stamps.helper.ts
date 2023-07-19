import { EnvironmentHelper } from './environment.helper'

export type Stamps = {
    id: string,
    insert: string,
    update: string
    dataset: {
        name: string
    }
}

export class StampsHelper {

    public static get DEFAULT_STAMP_ID() { return EnvironmentHelper.get('DEFAULT_STAMP_ID', '_id') }
    public static get DEFAULT_STAMP_INSERT() { return EnvironmentHelper.get('DEFAULT_STAMP_INSERT', 'createdAt') }
    public static get DEFAULT_STAMP_UPDATE() { return EnvironmentHelper.get('DEFAULT_STAMP_UPDATE', 'updatedAt') }
    public static get DEFAULT_STAMP_DATASET_NAME_PREFIX() { return EnvironmentHelper.get('DEFAULT_STAMP_DATASET_NAME_PREFIX', 'raw_mongodb_') }

    public static extract(object: any, attribute: string = '__stamps') {

        const stamps = (object?.[attribute] ?? {}) as Stamps

        delete object?.[attribute]
        
        stamps.id = stamps.id ?? StampsHelper.DEFAULT_STAMP_ID
        stamps.insert = stamps.insert ?? StampsHelper.DEFAULT_STAMP_INSERT
        stamps.update = stamps.update ?? StampsHelper.DEFAULT_STAMP_UPDATE
        
        stamps.dataset = stamps.dataset ?? {}
        stamps.dataset.name = stamps.dataset.name ?? StampsHelper.DEFAULT_STAMP_DATASET_NAME_PREFIX
        
        return stamps

    }

}