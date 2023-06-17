import { randomUUID } from 'crypto'

export class LoggerHelper {

    static get id() { return '{random}' }

    #transaction

    constructor() {
        this.#transaction = randomUUID()
    }

    static from(request) {
        return request.logger
    }

    get transaction() { return this.#transaction  }

    error(message, ...fields) { console.error(this.transaction, message, ...fields) }
    warn(message, ...fields) { console.warn(this.transaction, message, ...fields) }
    log(message, ...fields) { console.log(this.transaction, message, ...fields) }
    info(message, ...fields) { console.info(this.transaction, message, ...fields) }
    debug(message, ...fields) { console.debug(this.transaction, message, ...fields) }

}