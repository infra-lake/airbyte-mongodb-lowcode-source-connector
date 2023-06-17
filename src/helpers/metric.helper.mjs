import { collectDefaultMetrics, register, Counter } from 'prom-client'
import { EnvironmentHelper } from './environment.helper.mjs'

export class MetricHelper {

    static #configured = false

    static #http_received_request_total
    static get http_received_request_total() { return MetricHelper.#http_received_request_total }

    static config() {

        if (MetricHelper.#configured) {
            return
        }

        collectDefaultMetrics()

        register.setDefaultLabels({
            service: EnvironmentHelper.PROJECT_NAME,
            service_version: EnvironmentHelper.PROJECT_VERSION
        })

        MetricHelper.#http_received_request_total = new Counter({
            name: 'http_received_request_total',
            help: 'Total of Received HTTP Requests',
            labelNames: [ 'path', 'status' ]
        })

        MetricHelper.#configured = true

    }
    
    static get contentType() { return register.contentType }
    static async payload() { return await register.metrics() }

}

MetricHelper.config()
