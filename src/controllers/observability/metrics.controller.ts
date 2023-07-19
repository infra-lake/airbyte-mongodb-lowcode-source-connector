import { MetricHelper } from '../../helpers/metric.helper'
import { RegexHTTPController, HTTPIncomingMessage, HTTPServerResponse } from '../../regex'

export class MetricsController implements RegexHTTPController {

    public static readonly path = '^/metrics$'

    public async get(request: HTTPIncomingMessage, response: HTTPServerResponse) {
        response.setHeader('Content-Type', MetricHelper.contentType)
        response.setStatusCode(200)
        response.write(await MetricHelper.payload())
        response.end()
    }

}