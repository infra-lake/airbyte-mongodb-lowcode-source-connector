
export class DateHelper {

    public static parse(value: string): Date {

        const model = '0000-01-01T00:00:00.000000Z'

        if (value.length > model.length) {
            throw new Error(`invalid date: "${value}"`)
        }

        try {
            const result = new Date(`${value}${model.substring(value.length)}`)
            return result as any
        } catch (error) {
            throw new Error(`invalid date: "${value}"`)
        }

    }

    public static stringify(value: Date) {
        const date = value.toISOString()
        const result = `${date.substring(0, date.length - 1)}000Z`
        return result
    }

}