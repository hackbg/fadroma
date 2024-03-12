import { decode, u64 } from '@hackbg/borshest'

type Connection = { abciQuery: (path: string) => Promise<Uint8Array> }

export async function getCurrentEpoch (connection: Connection) {
  const binary = await connection.abciQuery("/shell/epoch")
  return decode(u64, binary)
}
