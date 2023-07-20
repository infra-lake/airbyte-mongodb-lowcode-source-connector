import http from 'http'
import https from 'https'
import { HTTPIncomingMessage, HTTPServerResponse, Logger, Regex } from '../regex'
import { ResilienceHelper } from './resilience.helper'

export type HTTPRequestInput<T extends 'http' | 'https'> = { url: string, options: T extends 'http' ? http.RequestOptions : https.RequestOptions }

export type HTTPHelperIncomingInput = { message: http.IncomingMessage, transactional: boolean }

export class HTTPHelper {

    public static incoming({ message, transactional }: HTTPHelperIncomingInput): HTTPIncomingMessage {

        const request = message as any as HTTPIncomingMessage
        
        if (transactional) {
            request.logger = Regex.register(Logger)
            request.transaction = request.logger.transaction as string
        }

        request.getURL = () => new URL(request.url as string, `http://${request.headers.host}`)
        request.body = async () => await HTTPHelper.body(request)
        request.json = async <T>() => JSON.parse(await request.body()) as T
        
        return request
    
    }

    public static response(response: http.ServerResponse): HTTPServerResponse {
    
        const _response = response as any as HTTPServerResponse
    
        _response.setStatusCode = value => {
            if (value === 401 || value === 423 || value === 429 || value >= 500) {
                ResilienceHelper.increment()
                _response.setHeader('Retry-After', ResilienceHelper.backoff())
            }
            _response.statusCode = value
        }
    
        return _response
    
    }

    public static async body(request: HTTPIncomingMessage) {
        return new Promise<string>((resolve, reject) => {
            let data = ''
            request
                .on('data', (chunk: string) => data += chunk)
                .on('end', () => resolve(data))
                .on('error', reject)
        })
    }

    public static async request<T extends 'http' | 'https'>({ url, options }: HTTPRequestInput<T>) {

        const type = url.startsWith('http:') ? 'http' : 'https' as T

        const { request: _request } = type === 'http' ? http : https

        return new Promise<HTTPIncomingMessage>((resolve, reject) => {
            const __request = _request(url, options, (message: http.IncomingMessage) => {
                const _message = HTTPHelper.incoming({ message, transactional: false })
                resolve(_message)
            })
            __request.on('error', reject)
            __request.end()
        })

    }

}