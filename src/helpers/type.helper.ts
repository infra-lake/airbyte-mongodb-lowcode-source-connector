
export class TypeHelper {

    public static toDate(input: string) {

        const model = '0000-01-01T00:00:00.000Z'

        if (input.length > model.length) {
            throw new Error(`invalid date: "${input}"`)
        }

        try {
            const result = new Date(`${input}${model.substring(input.length)}`)
            return result as any
        } catch (error) {
            throw new Error(`invalid date: "${input}"`)
        }

    }

    public static toNumber(input: string) {

        const result = Number(input)

        if (Number.isNaN(result)) {
            throw new Error(`invalid number: "${input}"`)
        }

        return result

    }



}