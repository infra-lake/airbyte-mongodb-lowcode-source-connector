import { BigQuery, Dataset, TableSchema } from "@google-cloud/bigquery";
import { BadRequestError } from "../exceptions/badrequest.error";
import { Logger, Request, Response } from "../regex";

export type DatasetInput = { client: BigQuery, name: string }
export type TableInput = { client: BigQuery, dataset: string, table: TableSchema & { name: string }  }

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

}