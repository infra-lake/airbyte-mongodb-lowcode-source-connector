import amqp, { Channel, ChannelWrapper } from 'amqp-connection-manager'
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'
import { ConsumeMessage, Options } from 'amqplib'
import { BadRequestError } from '../exceptions/badrequest.error'
import { RegexAMQPController } from '../regex/amqp'
import { EnvironmentHelper } from './environment.helper'
import { HTTPHelper } from './http.helper'
import { ObjectHelper } from './object.helper'

export interface Details {
    rate?: number
}

export interface GarbageCollection {
    fullsweep_after?: number
    max_heap_size?: number
    min_bin_vheap_size?: number
    min_heap_size?: number
    minor_gcs?: number
}

export interface BackingQueueStatus {
    avg_ack_egress_rate?: number
    avg_ack_ingress_rate?: number
    avg_egress_rate?: number
    avg_ingress_rate?: number
    delta?: Array<number | string>
    len?: number
    mode?: string
    next_deliver_seq_id?: number
    next_seq_id?: number
    num_pending_acks?: number
    num_unconfirmed?: number
    q1?: number
    q2?: number
    q3?: number
    q4?: number
    target_ram_count?: string
    version?: number
}

export interface RabbitMQQueue {
    arguments?: Record<string, any>
    auto_delete?: boolean
    backing_queue_status?: BackingQueueStatus
    consumer_capacity?: number
    consumer_utilisation?: number
    consumers?: number
    durable?: boolean
    effective_policy_definition?: Record<string, any>
    exclusive?: boolean
    exclusive_consumer_tag?: null
    garbage_collection?: GarbageCollection
    head_message_timestamp?: null
    idle_since?: Date
    memory?: number
    message_bytes?: number
    message_bytes_paged_out?: number
    message_bytes_persistent?: number
    message_bytes_ram?: number
    message_bytes_ready?: number
    message_bytes_unacknowledged?: number
    messages?: number
    messages_details?: Details
    messages_paged_out?: number
    messages_persistent?: number
    messages_ram?: number
    messages_ready?: number
    messages_ready_details?: Details
    messages_ready_ram?: number
    messages_unacknowledged?: number
    messages_unacknowledged_details?: Details
    messages_unacknowledged_ram?: number
    name: string
    node?: string
    operator_policy?: null
    policy?: null
    recoverable_slaves?: null
    reductions?: number
    reductions_details?: Details
    single_active_consumer_tag?: null
    state?: string
    type?: string
    vhost?: string
}

export type AMQPAssertInputType = 'queue' | 'exchange' | 'bind'

export type AMQPAssertInputOptions<T extends AMQPAssertInputType> =
    T extends 'queue' ? { options: Options.AssertQueue } :
    T extends 'exchange' ? { type: string, options: Options.AssertExchange } :
    { pattern: string, args?: any }

export type AMQPAssertInput<T extends AMQPAssertInputType> = 
    { type: T, options: AMQPAssertInputOptions<T> } & 
    (T extends 'bind' ? { queue: string, exchange: string } : { name: string })

export type AMQPConsumeInputAsserts = {
    queue: Omit<AMQPAssertInput<'queue'>, 'type' | 'options'> & { options: AMQPAssertInputOptions<'queue'>['options'] },
    exchange?: Omit<AMQPAssertInput<'exchange'>, 'type' | 'options'> & { type: AMQPAssertInputOptions<'exchange'>['type'], options: AMQPAssertInputOptions<'exchange'>['options'] },
    bind?: Omit<AMQPAssertInput<'bind'>, 'type' | 'queue' | 'exchange'>
}
export type AMQPConsumeInput<T extends RegexAMQPController> = {
    name: string,
    handle: T['handle'],
    asserts: AMQPConsumeInputAsserts,
    options?: Options.Consume
}

export class RabbitMQHelper {

    private static _connection?: IAmqpConnectionManager = undefined
    private static readonly _channels: Array<ChannelWrapper> = []
    private static readonly consumers: Array<string> = []

    public static get connection(): IAmqpConnectionManager | undefined {
        return RabbitMQHelper._connection
    }

    public static get channels(): Array<ChannelWrapper> {
        return RabbitMQHelper._channels
    }

    public static get uris() {
        return {
            amqp: EnvironmentHelper.get('RABBITMQ_AMQP_URLS', '').split(',').filter(url => url),
            http: EnvironmentHelper.get('RABBITMQ_HTTP_URL', '')
        }
    }

    public static get vhost() {
        const result = EnvironmentHelper.get('RABBITMQ_AMQP_VHOST', '%2F')
        return result
    }

    public static connect() {
        RabbitMQHelper._connection = amqp.connect(RabbitMQHelper.uris.amqp)
        return RabbitMQHelper
    }

    public static async queues(): Promise<Array<RabbitMQQueue>> {

        const { uris } = RabbitMQHelper

        const [username, password] = uris.amqp[0].substring(uris.amqp[0].indexOf('://') + 3, uris.amqp[0].indexOf('@')).split(':')

        const response = await HTTPHelper.request({
            url: `${uris.http}/api/queues/${RabbitMQHelper.vhost}`, options: {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
                }
            }
        })

        const queues = await response.json<Array<RabbitMQQueue>>()

        return queues

    }

    public static async assert<T extends AMQPAssertInputType>(input: AMQPAssertInput<T>) {

        if (!ObjectHelper.has(RabbitMQHelper.connection)) {
            throw new BadRequestError('amqp connection was not bootstraped')
        }

        const wrapper = (RabbitMQHelper.connection as IAmqpConnectionManager).createChannel({
            json: false,
            setup: (channel: Channel) => {

                if (input.type === 'queue') {
                    const { options } = input.options as AMQPAssertInputOptions<'queue'>
                    return channel.assertQueue((input as any).name, options)
                }

                if (input.type === 'exchange') {
                    const { type, options } = input.options as AMQPAssertInputOptions<'exchange'>
                    return channel.assertExchange((input as any).name, type, options)
                }

                if (input.type === 'bind') {
                    const { pattern, args } = input.options as AMQPAssertInputOptions<'bind'>
                    return channel.bindQueue((input as any).queue, (input as any).exchange, pattern, args)
                }

            }
        })

        await wrapper.waitForConnect()
        await wrapper.close()

    }

    public static async consume<T extends RegexAMQPController>({ name, handle, asserts, options }: AMQPConsumeInput<T>) {

        const _consumer = `${name}:${asserts.queue.name}`
        const exists = RabbitMQHelper.consumers.filter(consumer => consumer === _consumer).length > 0
        if (exists) {
            return
        }

        if (!ObjectHelper.has(RabbitMQHelper.connection)) {
            throw new BadRequestError('amqp connection was not bootstraped')
        }

        const wrapper = (RabbitMQHelper.connection as IAmqpConnectionManager).createChannel({
            json: false,
            setup: (channel: Channel) => {

                const promises = []

                if (ObjectHelper.has(asserts.exchange)) {
                    promises.push(channel.assertExchange(
                        asserts.exchange?.name as string, 
                        asserts.exchange?.type as string, 
                        asserts.exchange?.options
                    ))
                }

                promises.push(channel.assertQueue(asserts.queue.name, asserts.queue.options))

                if (ObjectHelper.has(asserts.bind)) {
                    promises.push(channel.bindQueue(
                        asserts.queue.name,
                        asserts.exchange?.name as string, 
                        asserts.bind?.options.pattern as string,
                        asserts.bind?.options.args
                    ))
                }

                promises.push(channel.consume(asserts.queue.name, async (message) => {
                    if (!ObjectHelper.has(message)) {
                        return
                    }
                    await handle(message as ConsumeMessage, channel)
                }, options))

                return Promise.all(promises)

            }
        })

        await wrapper.waitForConnect()

        RabbitMQHelper.channels.push(wrapper)
        RabbitMQHelper.consumers.push(_consumer)

    }

}