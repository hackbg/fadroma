import { decode, u64 } from '../deps.ts'
import type { ConnectionBase } from './namada.ts'
import type { Height } from './namadaBlock.ts'
export type Epoch = number|bigint|string
export const fetchEpoch = async ({ abciQuery }: ConnectionBase, height?: Height) => {
  if (height !== undefined) {
    const binary = await abciQuery(`/shell/epoch_at_height/${height}`)
    return binary[0] ? decode(u64, binary.slice(1)) : null
  }
  return decode(u64, await abciQuery("/shell/epoch"))
}
export const fetchEpochDuration = async ({ decoder, fetchStorageValue }: ConnectionBase) =>
  decoder.epoch_duration(await fetchStorageValue(decoder.storage_keys().epochDuration))
export const fetchEpochFirstBlock = async ({ abciQuery }: ConnectionBase) =>
  Number(decode(u64, await abciQuery('/shell/first_block_height_of_current_epoch')))
