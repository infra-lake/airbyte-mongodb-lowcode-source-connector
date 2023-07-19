import { Channel, ConsumeMessage, Options } from 'amqplib'
import { AMQPConsumeInputAsserts, RabbitMQHelper } from '../helpers/rabbitmq.helper'
import { Regex, RegexField } from './ioc'

export type AMQPBootstrapOutput = { rabbitmq: RabbitMQHelper }

export type MessageControl = Pick<Channel, 'ack' | 'ackAll' | 'nack' | 'nackAll'>
export type RegexAMQPControllerConfig = {
    asserts: AMQPConsumeInputAsserts
    options?: Options.Consume
}
export interface RegexAMQPController {
    get config(): RegexAMQPControllerConfig
    handle(message: ConsumeMessage, control: MessageControl): void | Promise<void>
}

export class AMQP {

    public static async bootstrap(): Promise<AMQPBootstrapOutput> {

        const rabbitmq = RabbitMQHelper.connect()

        setInterval(async () => {

            const queues = await rabbitmq.queues()

            const controllers = queues
                .flatMap(queue => Regex.inject<RegexAMQPController | Array<RegexAMQPController>>(queue.name, 'amqp'))
                .filter(controler => controler)

            await Promise.all(controllers.map(async controller => {
                const name = (controller as any)[RegexField.ID]
                const { handle, config } = controller
                const { asserts, options } = config
                await rabbitmq.consume({ name, handle, asserts, options })
            }))

        }, 5000)


        return { rabbitmq }
    }

}