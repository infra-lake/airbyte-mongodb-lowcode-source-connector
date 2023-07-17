
export class ThreadHelper {

    private constructor() { }

    public static async sleep(milliseconds: number) {
        await new Promise(
            resolve => setTimeout(resolve, milliseconds)
        )
    }

}
