import { randomUUID } from 'crypto'
import { HTTPIncomingMessage } from './http'

export class Logger {

    public static get regex() { return '{random}' }

    private _transaction: string

    constructor(__transaction?: string) {
        this._transaction = __transaction ?? randomUUID()
    }

    public static from(request: HTTPIncomingMessage) {
        return request.logger as Logger
    }

    public get transaction() { return this._transaction  }

    public error(message: any, ...fields: any[]) { console.error(this.transaction, message, ...fields) }
    public warn(message: any, ...fields: any[]) { console.warn(this.transaction, message, ...fields) }
    public log(message: any, ...fields: any[]) { console.log(this.transaction, message, ...fields) }
    public info(message: any, ...fields: any[]) { console.info(this.transaction, message, ...fields) }
    public debug(message: any, ...fields: any[]) { console.debug(this.transaction, message, ...fields) }

}