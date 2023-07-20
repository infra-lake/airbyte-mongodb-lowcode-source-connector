import { BigQuery, TableSchema } from "@google-cloud/bigquery";

export type DatasetInput = { client: BigQuery, name: string }
export type TableInput = { client: BigQuery, dataset: string, table: TableSchema & { name: string } }
export type SanitizeInput = { value: string }

export class BigQueryHelper {

    public static async dataset({ client, name }: DatasetInput) {

        const result = client.dataset(name)

        const [exists] = await result.exists()
        if (!exists) {
            await result.create()
        }

        return result

    }

    public static async table({ client, dataset: _dataset, table }: TableInput) {

        const __dataset = await BigQueryHelper.dataset({ client, name: _dataset })

        const result = __dataset.table(table.name)

        const [exists] = await result.exists()
        if (!exists) {
            await result.create({ schema: table.fields })
        }

        return result

    }

    public static sanitize({ value }: SanitizeInput) {
        const result = value.trim().replace(/\-/g, '_').replace(/\s/g, '_').replace(/\./g, '_')
        return result
    }

}