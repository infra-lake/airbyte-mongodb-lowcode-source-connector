import { WorkerTask } from '../regex'

export class WorkerTaskFailedException extends Error {
    constructor({ name }: WorkerTask, public readonly errors: Error[]) {
        super(`worker "${name}": fail when execute task`, { cause: errors[errors.length - 1] })
    }
}