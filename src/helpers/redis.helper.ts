import { createClient } from 'redis'

export class RedisHelper {

    private _client

    constructor(url: string) {
        this._client = createClient({ url })
    }

    public get client() { return this._client }

    public async connect() {
        await this.client.connect()
    }

}