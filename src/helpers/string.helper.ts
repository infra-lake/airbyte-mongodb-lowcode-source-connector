
export class StringHelper {

    public static empty(value?: string) {
        return (value?.trim() || '') === ''
    }

}