import type * as Namada from './namadaTypes.ts'

export function fetchStorageValue (
  connection: Pick<Namada.ConnectionBase, 'abciQuery'>, key: string
): Promise<Uint8Array> {
  return connection.abciQuery(`/shell/value/${key}`)
}
