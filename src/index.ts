import { MongoClient } from 'mongodb'
import { BuilderAirbyteController } from './controllers/airbyte/builder.controller'
import { ConnectionAirbyteController } from './controllers/airbyte/connection.controller'
import { AirbyteController } from './controllers/airbyte/controller'
import { ExportController } from './controllers/export.controller'
import { HealthController } from './controllers/observability/health.controller'
import { MetricsController } from './controllers/observability/metrics.controller'
import { NotFoundController } from './controllers/default/notfound.controller'
import { EnvironmentHelper } from './helpers/environment.helper'
import { MetricHelper } from './helpers/metric.helper'
import { MongoDBHelper } from './helpers/mongodb.helper'
import { Logger, Regex, RegexApplication, Server } from './regex'

EnvironmentHelper.config()
MetricHelper.config()

Regex.register(MongoClient, EnvironmentHelper.get('MONGODB_URI'))
Regex.register(MongoDBHelper)

Regex.controller(NotFoundController)
Regex.controller(HealthController)
Regex.controller(MetricsController)
Regex.controller(ExportController)
Regex.controller(AirbyteController)
Regex.controller(BuilderAirbyteController)
Regex.controller(ConnectionAirbyteController)

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

