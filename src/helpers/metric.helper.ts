import { collectDefaultMetrics, register, Counter, Gauge } from 'prom-client'
import { EnvironmentHelper } from './environment.helper'

export class MetricHelper {

    private static configured = false

    private static _http_received_request_total = new Counter({
        name: 'http_received_request_total',
        help: 'Total of Received HTTP Requests',
        labelNames: [ 'path', 'status' ]
    })
    public static get http_received_request_total() { return MetricHelper._http_received_request_total }

    private static _rabbitmq_received_message_total = new Counter({
        name: 'rabbitmq_received_message_total',
        help: 'Total of Received RabbitMQ AMQP Messages',
        labelNames: [ 'queue', 'status' ]
    })
    public static get rabbitmq_received_message_total() { return MetricHelper._rabbitmq_received_message_total }

    private static _service_exponential_backoff_total = new Gauge({
        name: 'service_exponential_backoff_total',
        help: 'Exponential Backoff of Service'
    })
    public static get service_exponential_backoff_total() { return MetricHelper._service_exponential_backoff_total }
    
    public static config() {

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
    
    public static get contentType() { return register.contentType }
    public static async payload() { return await register.metrics() }

}
