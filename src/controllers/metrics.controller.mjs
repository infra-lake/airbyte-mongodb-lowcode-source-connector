import { MetricHelper } from '../helpers/metric.helper.mjs'

export class MetricsController {

    static path = '^/metrics$'
    
    async get(request, response) {
        response.setHeader('Content-Type', MetricHelper.contentType)
        response.statusCode = 200
        response.write(await MetricHelper.payload())
        response.end()
    }

}