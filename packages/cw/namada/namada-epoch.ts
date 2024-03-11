import * as Borsher from 'borsher'
import { decode, struct, u64 } from '@hackbg/borshest'

const Schema = Borsher.BorshSchema

type Connection = { abciQuery: (path: string) => Promise<Uint8Array> }

export async function getCurrentEpoch (connection: Connection) {
  const binary = await connection.abciQuery("/shell/epoch")
  return decode(epochSchema, binary)
}

const epochSchema = struct(["epoch", u64])
