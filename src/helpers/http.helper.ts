import { Request } from '../regex';

export class HTTPHelper {

    public  static async body(request: Request) {
        return new Promise<string>((resolve, reject) => {
            let data = ''
            request
                .on('data', (chunk: string) => data += chunk)
                .on('end', () => resolve(data))
                .on('error', reject)
                .on('pause', () => request.logger.debug('request paused'))
                .on('resume', () => request.logger.debug('request resumed'))
        })
    }

}