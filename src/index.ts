import { MongoClient } from 'mongodb'
import { ExportController } from './controllers/export.controller'
import { HealthController } from './controllers/health.controller'
import { MetricsController } from './controllers/metrics.controller'
import { NotFoundController } from './controllers/notfound.controller'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { Regex, RegexApplication, Server } from './regex'
import { Logger } from './regex/logger'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URI'))

Regex.register(NotFoundController)
Regex.register(HealthController)
Regex.register(MetricsController)
Regex.register(ExportController)

RegexApplication.create({
    startup: (server: Server) => {
        const port = parseInt(EnvironmentHelper.get('PORT', '4000'))
        server.listen(port, () => {
            const logger = Regex.register(Logger)
            logger.log('airbyte-mongodb-lowcode-source was successfully started on port', port)
            Regex.unregister(logger)
        })
    }
})

