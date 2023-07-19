import { ConsumeMessage } from 'amqplib'
import { ObjectHelper } from '../helpers/object.helper'
import { MessageControl, RegexAMQPController, RegexAMQPControllerConfig } from '../regex/amqp'


export class WorkerController implements RegexAMQPController {

    public static readonly pattern = '^teste$'

    public get config(): RegexAMQPControllerConfig {
        return {
            asserts: {
                queue: {
                    name: 'teste',
                    options: { durable: true }
                }
            }
        }
    }

    public handle(message: ConsumeMessage, control: MessageControl) {

        if (!ObjectHelper.has(message)) {
            return
        }

        console.log('opa!!')

        control.ack(message)

    }



}