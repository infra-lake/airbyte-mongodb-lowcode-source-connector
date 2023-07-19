export class InvalidParameterError extends Error {
    constructor(public readonly name: string, message?: string, cause?: any) {
        super(`parameter "${name}" is invalid ${message ?? `: "${message}"`}`, { cause })
    }
}