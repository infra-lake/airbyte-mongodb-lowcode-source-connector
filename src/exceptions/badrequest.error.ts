export class BadRequestError extends Error {
    constructor(message: string, cause?: any) {
        super(message, { cause })
    }
}