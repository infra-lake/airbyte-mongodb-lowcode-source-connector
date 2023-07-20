import amqp, { Channel, ChannelWrapper } from 'amqp-connection-manager'
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'
import { PublishOptions } from 'amqp-connection-manager/dist/esm/ChannelWrapper'
import { ConsumeMessage, Options } from 'amqplib'
import { BadRequestError } from '../exceptions/badrequest.error'
import { InvalidParameterError } from '../exceptions/invalidparameter.error'
import { Logger, Regex, TransactionalContext } from '../regex'
import { RegexRabbitMQController } from '../regex/rabbitmq'
import { EnvironmentHelper } from './environment.helper'
import { HTTPHelper } from './http.helper'
import { ObjectHelper } from './object.helper'
import { MetricHelper } from './metric.helper'

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

export type RabbitMQAssertInputKind = 'queue' | 'exchange' | 'bind'

export type RabbitMQAssertInputOptions<T extends RabbitMQAssertInputKind> =
    T extends 'queue' ? Options.AssertQueue :
    T extends 'exchange' ? Options.AssertExchange :
    any

export type RabbitMQAssertInput<T extends RabbitMQAssertInputKind> =
    { kind: T } &
    (T extends 'bind' ? { queue: string, exchange: string, pattern: string } : T extends 'exchange' ? { name: string, type: string } : { name: string }) &
    (T extends 'bind' ? { args?: RabbitMQAssertInputOptions<T> } : { options?: RabbitMQAssertInputOptions<T> })

export class RabbitMQAssertInputBuilder {
    private constructor() { }
    public static build<T extends RabbitMQAssertInputKind>(value: RabbitMQAssertInput<T>) {
        return value
    }
}

export type RabbitMQConsumeInput<T extends RegexRabbitMQController> = {
    consumer: string,
    queue: string,
    handle: T['handle'],
    options?: Options.Consume
}

export type RabbitMQProduceInput = {
    queue: string,
    content: Buffer | string | unknown,
    options?: PublishOptions
}

export interface RabbitMQIncomingMessage extends ConsumeMessage, TransactionalContext {
    json<T>(): T
}

export class RabbitMQHelper {

    private static _connection?: IAmqpConnectionManager = undefined
    private static _producer?: ChannelWrapper = undefined
    private static readonly consumers: Array<string> = []

    public static get connection(): IAmqpConnectionManager | undefined {
        return RabbitMQHelper._connection
    }

    private static get producer(): ChannelWrapper {
        if (!ObjectHelper.has(RabbitMQHelper._producer)) {
            RabbitMQHelper._producer = (RabbitMQHelper.connection as IAmqpConnectionManager).createChannel({ json: false })
        }
        return RabbitMQHelper._producer as ChannelWrapper
    }

    public static get urls() {
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
        RabbitMQHelper._connection = amqp.connect(RabbitMQHelper.urls.amqp)
        return RabbitMQHelper
    }

    public static async queues(): Promise<Array<RabbitMQQueue>> {

        const { urls } = RabbitMQHelper

        const [username, password] = urls.amqp[0].substring(urls.amqp[0].indexOf('://') + 3, urls.amqp[0].indexOf('@')).split(':')

        const response = await HTTPHelper.request({
            url: `${urls.http}/api/queues/${RabbitMQHelper.vhost}`, options: {
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

    public static async assert<T extends RabbitMQAssertInputKind>(...inputs: Array<RabbitMQAssertInput<T>>) {

        if (!ObjectHelper.has(RabbitMQHelper.connection)) {
            throw new BadRequestError('amqp connection was not bootstraped')
        }

        const wrapper = (RabbitMQHelper.connection as IAmqpConnectionManager).createChannel({
            json: false,
            setup: (channel: Channel) => {
                return Promise.all(inputs.map((input => {

                    if (input.kind === 'queue') {
                        const { name, options } = input as RabbitMQAssertInput<'queue'>
                        return channel.assertQueue(name, options)
                    }

                    if (input.kind === 'exchange') {
                        const { name, type, options } = input as RabbitMQAssertInput<'exchange'>
                        return channel.assertExchange(name, type, options)
                    }

                    if (input.kind === 'bind') {
                        const { queue, exchange, pattern, args } = input as RabbitMQAssertInput<'bind'>
                        return channel.bindQueue(queue, exchange, pattern, args)
                    }

                    throw new InvalidParameterError('kind', `cannot assert kind "${input.kind}", assert kind must be "queue", "exchange" or "bind"`)

                })))
            }
        })

        await wrapper.waitForConnect()
        await wrapper.close()

    }

    public static async consume<T extends RegexRabbitMQController>({ consumer, queue, handle, options }: RabbitMQConsumeInput<T>) {

        const _key = `${consumer}:${queue}`
        const exists = RabbitMQHelper.consumers.filter(key => key === _key).length > 0
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

                promises.push(channel.consume(queue, async (message) => {

                    if (!ObjectHelper.has(message)) {
                        return
                    }
                    
                    const logger = Regex.register(Logger, message?.properties.correlationId)

                    MetricHelper.rabbitmq_received_message_total.inc({ queue })

                    try {
            
                        const _message = message as any as RabbitMQIncomingMessage
                        _message.logger = logger
                        _message.transaction = _message.logger.transaction
                        _message.json = <T>() => JSON.parse(_message.content.toString('utf-8')) as T
    
                        await handle(queue, _message, channel)

                        MetricHelper.rabbitmq_received_message_total.inc({ queue, status: 'success' })

                    } catch (error) {
                        logger.error('an unexpected error occurred:', error)
                        MetricHelper.rabbitmq_received_message_total.inc({ queue, status: 'error' })
                        channel.nack(message as ConsumeMessage)
                    } finally {
                        Regex.unregister(logger)
                    }

                }, options))

                return Promise.all(promises)

            }
        })

        await wrapper.waitForConnect()

        RabbitMQHelper.consumers.push(_key)

    }

    public static async produce({ queue, content, options }: RabbitMQProduceInput) {
        return await RabbitMQHelper.producer.sendToQueue(queue, content, options)
    }



}