import { MetricHelper } from '../helpers/metric.helper'
import { RegexController, Request, Response } from '../regex'

export class MetricsController implements RegexController {

    static path = '^/metrics$'

    async get(request: Request, response: Response) {
        response.setHeader('Content-Type', MetricHelper.contentType)
        response.statusCode = 200
        response.write(await MetricHelper.payload())
        response.end()
    }

}