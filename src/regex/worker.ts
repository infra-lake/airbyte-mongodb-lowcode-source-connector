import { WorkerRunFailedException } from '../exceptions/worker.run.failed.exception'
import { ThreadHelper } from '../helpers/thread.helper'
import { Logger } from './logger'

export abstract class Worker {

    public abstract get name(): string
    protected abstract get attempts(): number
    protected abstract get logger(): Logger
    protected abstract perform(attempt: number, error: Error): Promise<void>

    protected get milliseconds(): number {
        return 10000
    }

    public async run() {

        let attempt = -1
        let tryAgain = false
        const errors: Error[] = []

        do {

            attempt++

            try {

                await this.perform(attempt, errors[errors.length - 1])

                tryAgain = false

            } catch (error) {

                tryAgain = attempt < this.attempts;

                (error as any).attempt = attempt;
                (error as any).tryAgain = tryAgain
                errors.push(error as Error)

                if (!tryAgain) {
                    throw new WorkerRunFailedException(this, errors)
                }

                await this.backOff(attempt)

            }

        } while (tryAgain)

    }

    private async backOff(attempt: number) {

        try {

            const milliseconds = this.milliseconds * Math.pow(2, attempt)

            this.logger.log(`worker ${this.name}:`, 'waiting for the next attempt:', { attempt, milliseconds })

            await ThreadHelper.sleep(milliseconds)

        } catch (error) {
            this.logger.error(`worker ${this.name}:`, 'error when calculate exponential backoff time:', error)
        }

    }

}



