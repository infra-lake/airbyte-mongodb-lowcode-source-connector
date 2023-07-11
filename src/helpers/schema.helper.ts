import yaml from 'js-yaml'
import { MongoClient } from 'mongodb'
import { InputData, JSONSchemaTargetLanguage, SerializedRenderResult, jsonInputForTargetLanguage, quicktype } from 'quicktype-core'
import { Regex } from '../regex'
import { AirbyteStream } from './airbyte.helper'
import { ExporterHelper, OutputInput } from './exporter.helper'

const language = new JSONSchemaTargetLanguage()

export class SchemaHelper {

    public static async infer({ database, name }: AirbyteStream, { stamps, now }: Omit<OutputInput, 'database' | 'collection' | 'window'>) {

        const mongodb = Regex.inject(MongoClient)
        
        return new Promise<string>((resolve, reject) => {

            const samples: string[] = []
            
            mongodb.db(database).collection(name).find().stream()
                .on('data', async chunk => {
                    const sample = JSON.stringify(ExporterHelper.output(chunk, { database, collection: name, stamps, now }))
                    samples.push(sample)
                })
                .on('end', async () => {

                    const json = jsonInputForTargetLanguage(language, undefined, false)
                    await json.addSource({ name, samples })
                    
                    const data = new InputData()
                    data.addInput(json)
                    
                    const schema = await quicktype({
                        inputData: data,
                        lang: language,
                        allPropertiesOptional: true,
                        inferBooleanStrings: false,
                        inferDateTimes: false,
                        inferEnums: false,
                        inferMaps: false,
                        inferUuids: false,
                        inferIntegerStrings: false
                    })

                    const result = SchemaHelper.serialize(schema)
                    
                    resolve(result)
                
                })
                .on('error', (error) => {
                    reject(error)
                })
        })


    }

    private static serialize(schema: SerializedRenderResult): string {
        const { lines } = schema
        const tab = '\n        '
        const result = `${tab}${yaml.dump(JSON.parse(lines.join('\n'))).replace(/\n/g, tab).trim()}`
        return result

    }

}