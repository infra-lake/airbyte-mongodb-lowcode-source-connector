import { AMQP, AMQPBootstrapOutput } from './amqp'
import { HTTP, HTTPBootstrapOutput } from './http'

export type Settings = { http?: boolean, amqp?: boolean }
export type StartupInput = ({ http?: HTTPBootstrapOutput, amqp?: AMQPBootstrapOutput })
export type Startup = ((input: StartupInput) => Promise<void>) | ((input: StartupInput) => void)
export type Shutdown = (() => Promise<void>) | (() => void) | undefined
export type RegexAppCreateInput = { settings: Settings, startup: Startup, shutdown?: Shutdown }

export class RegexApplication {

    public static async create({ settings, startup, shutdown }: RegexAppCreateInput) {

        process.on('SIGILL', exit(shutdown))
        process.on('SIGTERM', exit(shutdown))
        process.on('SIGINT', exit(shutdown))

        const { http = false, amqp = false } = settings

        const input: StartupInput = {}

        if (http) {
            input.http = await HTTP.bootstrap()
        }

        if (amqp) {
            input.amqp = await AMQP.bootstrap()
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