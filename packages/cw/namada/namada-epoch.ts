import * as Borsher from 'borsher'

const Schema = Borsher.BorshSchema

type Connection = { abciQuery: (path: string) => Promise<Uint8Array> }

export async function getCurrentEpoch (connection: Connection) {
  const binary = await connection.abciQuery("/shell/epoch")
  return Borsher.borshDeserialize(epochSchema, binary)
}

const epochSchema = Schema.Struct({
  epoch: Schema.u64
})
