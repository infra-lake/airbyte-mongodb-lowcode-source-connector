import { MongoClient } from 'mongodb'
import { ExportController } from './controllers/export.controller'
import { HealthController } from './controllers/health.controller'
import { MetricsController } from './controllers/metrics.controller'
import { NotFoundController } from './controllers/notfound.controller'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { Regex, RegexApplication, Server, Logger } from './regex'
import { AirbyteBuilderController } from './controllers/airbyte/builder.controller'
import { MongoDBHelper } from './helpers/mongodb.helper'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URI'))
Regex.register(MongoDBHelper)

Regex.controller(NotFoundController)
Regex.controller(HealthController)
Regex.controller(MetricsController)
Regex.controller(ExportController)
Regex.controller(AirbyteBuilderController)

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

