import { ObjectHelper } from '../helpers/object.helper'
import { RabbitMQIncomingMessage } from '../helpers/rabbitmq.helper'
import { Regex } from '../regex'
import { MessageControl, RegexRabbitMQController, RegexRabbitMQControllerConfig } from '../regex/rabbitmq'
import { Export, ExportService, ExportSource, ExportTarget } from '../services/export.service'
import { ExportWorker } from '../workers/export.worker'


export class ExportWorkerController implements RegexRabbitMQController {

    public static readonly pattern = '^export:'

    public get config(): RegexRabbitMQControllerConfig { return {} }

    public async handle(queue: string, message: RabbitMQIncomingMessage, control: MessageControl) {

        
        const [_, _source, database, collection, _target] = queue.split(':')
        const source: ExportSource = { name: _source, database, collection }
        const target: ExportTarget = { name: _target }
        
        const { transaction } = message.json<{ transaction: string }>()

        const id = { transaction, source, target }

        message.logger.log('new event received:', id)

        const service = Regex.inject(ExportService)

        try {

            const data = await service.get(id) as Export

            const worker = new ExportWorker(message, data)

            message.logger.log(`starting worker "${worker.name}"...`)

            await worker.run()

            message.logger.log(`worker "${worker.name}" finished successfully`)

            service.update(id, { status: 'success' })

        } catch (error: any) {

            const _message = 'fail on worker export'
            message.logger.error(_message, error)
            service.update(
                id,
                {
                    status: 'error',
                    error: {
                        message: 'message' in error ? error.message : _message,
                        cause: 'cause' in error ? error.cause : error
                    }
                }
            )

        } finally {
            control.ack(message)
        }

    }



}