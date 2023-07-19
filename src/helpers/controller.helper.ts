import { BadRequestError } from "../exceptions/badrequest.error";
import { Logger, HTTPIncomingMessage, HTTPServerResponse } from "../regex";

export class ControllerHelper {

    public static catch(request: HTTPIncomingMessage, response: HTTPServerResponse, error: any) {
        
        const logger = Logger.from(request)

        logger.error('error:', error)

        const bad = error instanceof BadRequestError

        response.setStatusCode(bad ? 400 : 500)
        if (bad) {
            response.write(error.message)
        }

        response.end()

    }

}