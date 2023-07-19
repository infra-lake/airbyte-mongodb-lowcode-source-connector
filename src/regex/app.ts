import { InvalidParameterError } from '../exceptions/invalidparameter.error'
import { RabbitMQ, RabbitMQBootstrapOutput } from './rabbitmq'
import { HTTP, HTTPBootstrapOutput } from './http'

export type Settings = { http?: boolean, rabbitmq?: boolean }
export type StartupInput = ({ http?: HTTPBootstrapOutput, rabbitmq?: RabbitMQBootstrapOutput })
export type Startup = ((input: StartupInput) => Promise<void>) | ((input: StartupInput) => void)
export type Shutdown = (() => Promise<void>) | (() => void) | undefined
export type RegexAppCreateInput = { settings: Settings, startup: Startup, shutdown?: Shutdown }

export class RegexApplication {

    private static _TICK = 5000
    public static get TICK() { return RegexApplication._TICK }
    public static set TICK(value: number) {
        if ((value ?? 0) <= 0) {
            throw new InvalidParameterError('tick', 'must be greater than zero')
        } 
        RegexApplication._TICK = value 
    } 

    public static async create({ settings, startup, shutdown }: RegexAppCreateInput) {

        process.on('SIGILL', exit(shutdown))
        process.on('SIGTERM', exit(shutdown))
        process.on('SIGINT', exit(shutdown))

        const { http = false, rabbitmq = false } = settings

        const input: StartupInput = {}

        if (http) {
            input.http = await HTTP.bootstrap()
        }

        if (rabbitmq) {
            input.rabbitmq = await RabbitMQ.bootstrap()
        }

        await startup(input)

    }
}

function exit(shutdown: Shutdown) {
    return async () => {
        if (shutdown) {
            await shutdown()
        }
        process.exit(0)
    }
}