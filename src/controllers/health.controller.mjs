
export class HealthController {

    static path = '/health/(liveness|readiness)$'
    
    async get(request, response) {
        response.statusCode = 200
        response.end()
    }

}