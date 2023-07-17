import { FindCursor } from 'mongodb'
import Stream from 'stream'
import { ObjectHelper } from './object.helper'

export type StreamHelperCreateOptions<K, V> = {
    objectMode?: boolean
    transform?: (stream: Stream.Readable, value: K) => V
}

export class StreamHelper {

    public static create<K, V>(promise: Promise<K>, { objectMode = true, transform }: StreamHelperCreateOptions<K, V>): Stream.Readable {

        const stream = new Stream.Readable({ read() { }, objectMode })

        promise
            .then(value => ObjectHelper.has(transform) ? transform?.(stream, value) : stream.push(value))
            .catch(error => stream.destroy(error))
            .finally(() => stream.push(null))

        return stream

    }

}