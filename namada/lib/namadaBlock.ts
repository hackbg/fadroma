import { Tendermint } from '../deps.ts'
import { Error } from './namadaLog.ts'
import type { Context } from './namada.ts'
import type { Transaction } from './namadaTx.ts'
/** The height of a Namada block. */
export type Height = Tendermint.Height
/** A Namada block. */
export type Block = Tendermint.Block & { readonly transactions: Transaction[] }
export const fetchBlock = async (
  api: Context, options?: { height?: Height, hash?: string, results?: boolean, raw?: boolean }
): Promise<Block> => {
  const result      = await Tendermint.fetchBlock(api, { ...options, raw: true })
  const blockData   = result.responses!.block!.data!
  const resultsData = options?.results ? result.responses!.results!.data! : ""
  const decoded     = decodeBlock(api, options?.raw||false, result.height, blockData, resultsData)
  if (options?.raw) Object.assign(decoded, { responses: result.responses })
  return decoded as Block
}
export const decodeBlock = (
  { log, decoder, chain }: Context,
  raw:     boolean,
  h:       Height,
  block:   string,
  results: string,
) => {
  const height = (typeof h === 'bigint') ? h : (isNaN(Number(h)) ? undefined : BigInt(h!))
  if (!height) {
    log.error('could not detect block height in', block)
    if (raw) return {}
    throw new Error('could not detect block height', { block })
  }
  try {
    const { hash: id, header, transactions: decoded } = decoder.block(block, results||null)
    const transactions = decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
    return { chain: chain(), id, height, header, transactions }
  } catch (e: any) {
    log.error('failed to decode block:', { block, results })
    if (raw) return {}
    throw Object.assign(e, { block, results })
  }
}
