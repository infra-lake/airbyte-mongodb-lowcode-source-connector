import { MongoClient } from 'mongodb'
import { EnvironmentHelper } from '../helpers/environment.helper'
import { Regex } from '../regex'
import { SourceService } from './source.service'
import { TargetService } from './target.service'
import { ExportService } from './export.service'

export class SettingsService {

    public get database() { return EnvironmentHelper.get('MONGODB_DATABASE') as string }

    public async migrate() {

        const mongodb = Regex.inject(MongoClient)
        
        const collections = await mongodb.db(this.database).collections()
        
        const source = SourceService.COLLECTION
        const target = TargetService.COLLECTION
        const _export = ExportService.COLLECTION
        
        if (collections.filter(({ collectionName }) => collectionName === source).length <= 0) {
            await mongodb.db(this.database).createCollection(source)
        }
        
        if (collections.filter(({ collectionName }) => collectionName === target).length <= 0) {
            await mongodb.db(this.database).createCollection(target)
        }
        
        if (collections.filter(({ collectionName }) => collectionName === _export).length <= 0) {
            await mongodb.db(this.database).createCollection(_export)
        }

    }

}