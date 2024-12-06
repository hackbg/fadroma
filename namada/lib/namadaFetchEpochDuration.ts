import type * as Namada from './namadaTypes.ts'
import { fetchStorageValue } from './namadaFetchStorageValue.ts'

export async function fetchEpochDuration (connection: Namada.ConnectionBase) {
  const { epochDuration } = connection.decode.storage_keys()
  const binary = await fetchStorageValue(connection, epochDuration)
  return connection.decode.epoch_duration(binary)
}
