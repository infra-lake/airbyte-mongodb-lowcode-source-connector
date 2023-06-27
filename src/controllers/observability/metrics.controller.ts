import { MetricHelper } from '../../helpers/metric.helper'
import { RegexController, Request, Response } from '../../regex'

export class MetricsController implements RegexController {

    public static readonly path = '^/metrics$'

    public async get(request: Request, response: Response) {
        response.setHeader('Content-Type', MetricHelper.contentType)
        response.setStatusCode(200)
        response.write(await MetricHelper.payload())
        response.end()
    }

}