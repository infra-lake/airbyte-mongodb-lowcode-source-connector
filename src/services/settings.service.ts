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
        await mongodb.db(this.database).createCollection(SourceService.COLLECTION)
        await mongodb.db(this.database).createCollection(TargetService.COLLECTION)
        await mongodb.db(this.database).createCollection(ExportService.COLLECTION)
    }

}