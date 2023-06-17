import { MongoClient } from 'mongodb'
import { HealthController } from './controllers/health.controller.mjs'
import { MetricsController } from './controllers/metrics.controller.mjs'
import { NotFoundController } from './controllers/notfound.controller.mjs'
import { AppHelper } from './helpers/app.helper.mjs'
import { EnvironmentHelper } from './helpers/environment.helper.mjs'
import { LoggerHelper } from './helpers/logger.helper.mjs'
import { MongoDBHelper } from './helpers/mongodb.helper.mjs'
import { RegExpIOCHelper } from './helpers/regexpioc.helper.mjs'
import { ExportController } from './controllers/export.controller.mjs'

RegExpIOCHelper.register(MongoClient, MongoDBHelper.uri)
RegExpIOCHelper.register(NotFoundController)
RegExpIOCHelper.register(HealthController)
RegExpIOCHelper.register(MetricsController)
RegExpIOCHelper.register(ExportController)

const server = await AppHelper.create()

const port = parseInt(EnvironmentHelper.PORT ?? 4000)
server.listen(port, () => {
    const logger = RegExpIOCHelper.register(LoggerHelper)
    logger.log('airbyte-mongodb-lowcode-source was successfully started on port', port)
    RegExpIOCHelper.unregister(logger)
})