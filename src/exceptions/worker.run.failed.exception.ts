import { Worker } from '../regex'

export class WorkerRunFailedException extends Error {
    constructor({ name }: Worker, public readonly errors: Error[]) {
        super(`worker "${name}": fail when execute task`, { cause: errors[errors.length - 1] })
    }
}