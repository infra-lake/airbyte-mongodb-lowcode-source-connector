
export class ArrayHelper {

    public static split(array: Array<any>, parts: number = 0): Array<Array<any>> {
        const result = []
        const size = parseInt(array.length / ((parts ?? 0) < 1 ? 1 : parts) as any)
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size))
        }
        return result
    }
}