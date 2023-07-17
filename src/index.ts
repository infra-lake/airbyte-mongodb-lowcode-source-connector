import { MongoClient } from 'mongodb'
import { NotFoundController } from './controllers/default/notfound.controller'
import { ExploreController } from './controllers/explore.controller'
import { ExportController } from './controllers/export.controller'
import { HealthController } from './controllers/observability/health.controller'
import { MetricsController } from './controllers/observability/metrics.controller'
import { SettingsController } from './controllers/settings/controller'
import { SourceSettingsController } from './controllers/settings/source.controller'
import { TargetSettingsController } from './controllers/settings/target.controller'
import { ApplicationHelper } from './helpers/application.helper'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { RedisHelper } from './helpers/redis.helper'
import { Logger, Regex, RegexApplication, Server } from './regex'
import { ExportService } from './services/export.service'
import { SettingsService } from './services/settings.service'
import { SourceService } from './services/source.service'
import { TargetService } from './services/target.service'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URL'))
Regex.register(RedisHelper, EnvironmentHelper.get('REDIS_URL'))
Regex.register(SettingsService)
Regex.register(SourceService)
Regex.register(TargetService)
Regex.register(ExportService)

Regex.controller(NotFoundController)
Regex.controller(HealthController)
Regex.controller(MetricsController)
Regex.controller(SettingsController)
Regex.controller(SourceSettingsController)
Regex.controller(TargetSettingsController)
Regex.controller(ExportController)
Regex.controller(ExploreController)

RegexApplication.create({
    startup: async (server: Server) => {

        const settings = Regex.inject(SettingsService)
        await settings.migrate()

        const redis = Regex.inject(RedisHelper)
        await redis.connect()

        const port = ApplicationHelper.PORT
        server.listen(port, () => {
            const logger = Regex.register(Logger)
            logger.log('airbyte-mongodb-lowcode-source was successfully started on port', port)
            Regex.unregister(logger)
        })

    }
})

