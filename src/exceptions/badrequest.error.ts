export class BadRequestError extends Error {
    constructor(cause: any) {
        super(cause)
    }
}