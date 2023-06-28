
export class NumberHelper {

    public static parse(input: string) {

        const result = Number(input)

        if (Number.isNaN(result)) {
            throw new Error(`invalid number: "${input}"`)
        }

        return result

    }



}