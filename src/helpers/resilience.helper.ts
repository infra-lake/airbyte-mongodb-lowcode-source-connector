import { MetricHelper } from "./metric.helper"

let errors: number = 0

setInterval(() => { 
    errors = errors > 0 ? errors-1 : errors
    MetricHelper.service_exponential_backoff_total.set(errors) 
}, 1000)

export class ResilienceHelper {

    public static increment() {
        MetricHelper.service_exponential_backoff_total.set(++errors)
    }

    public static backoff() {
        
        const now = new Date()
        
        const future = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds() * (2 ** errors)
        )
        
        return future.getTime() - now.getTime()

    }

}

