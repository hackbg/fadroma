import { decode, u64 } from '../deps.ts'
import type { Context } from './namada.ts'
import type { Height } from './namadaBlock.ts'
export type Epoch = number|bigint|string
export const fetchEpoch = async ({ fetchAbciQuery }: Context, height?: Height) => {
  if (height !== undefined) {
    const binary = (await fetchAbciQuery(`/shell/epoch_at_height/${height}`)).value!
    return binary[0] ? decode(u64, binary.slice(1)) : null
  }
  return decode(u64, (await fetchAbciQuery("/shell/epoch")).value!)
}
export const fetchEpochDuration = async ({ decoder, fetchStorageValue }: Context) =>
  decoder.epoch_duration(await fetchStorageValue(decoder.storage_keys().epochDuration))
export const fetchEpochFirstBlock = async ({ fetchAbciQuery }: Context) =>
  Number(decode(u64, (await fetchAbciQuery('/shell/first_block_height_of_current_epoch')).value!))
