import { Logger } from "./logger"

export interface TransactionalContext {
    transaction: string
    logger: Logger
}