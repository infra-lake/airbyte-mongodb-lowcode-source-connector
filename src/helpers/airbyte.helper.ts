import fs from 'fs'

export type AirbyteTemplates = { [key: string]: HandlebarsTemplateDelegate | undefined, path: () => string }

export class AirbyteHelper {

    public static has(value: any) : boolean {
        return value !== null && value !== undefined
    }

    public static compile(templates: AirbyteTemplates, version: string) {
        if (version in templates) {
            return templates[version]
        }
        const template = fs.readFileSync(`${templates.path()}/${version}/template.hbs`).toString('utf-8')
        templates[version] = Handlebars.compile(template, { noEscape: true })
        return templates[version]
    }

}