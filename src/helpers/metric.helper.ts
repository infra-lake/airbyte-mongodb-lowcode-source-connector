import { collectDefaultMetrics, register, Counter } from 'prom-client'
import { EnvironmentHelper } from './environment.helper'

export class MetricHelper {

    private static configured = false

    private static _http_received_request_total = new Counter({
        name: 'http_received_request_total',
        help: 'Total of Received HTTP Requests',
        labelNames: [ 'path', 'status' ]
    })
    
    static get http_received_request_total() { return MetricHelper._http_received_request_total }

    static config() {

        if (MetricHelper.configured) {
            return
        }

        collectDefaultMetrics()

        register.setDefaultLabels({
            service: EnvironmentHelper.get('PROJECT_NAME'),
            service_version: EnvironmentHelper.get('PROJECT_VERSION')
        })

        MetricHelper.configured = true

    }
    
    static get contentType() { return register.contentType }
    static async payload() { return await register.metrics() }

}
