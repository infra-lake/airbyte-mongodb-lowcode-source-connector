import { BadRequestError } from "../exceptions/badrequest.error"

export class ArrayHelper {

    public static split(array: Array<any>, parts: number = 0): Array<Array<any>> {
        const result = []
        const size = parseInt(array.length / ((parts ?? 0) < 1 ? 1 : parts) as any)
        if (size <= 0) {
            throw new BadRequestError(`does not possible split ${array.length} items into ${parts} parts, you must set your split value less than or equal to ${array.length}`)
        }
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size))
        }
        return result
    }
}