import type { Core, Tendermint } from '../deps.ts'
import type { Chain } from './namada.ts'
import type { Transaction } from './namadaTx.ts'
import type { Decoder } from './namadaDecode.ts'
import { Decode } from '../pkg/fadroma_namada.js'
/** The height of a Namada block. */
export type Height = Tendermint.Height
/** A Namada block. */
export type Block = Tendermint.Block & {
  readonly chain: Core.ChainRef
  /** Transaction in block. */
  readonly transactions: Transaction[]
}
export const blockFromResponses = (
  responses: NonNullable<Block["responses"]>,
  options: { decoder?: Decoder, chain?: Chain, height?: string|number|bigint }
): Block => {
  const decoder = options.decoder || Decode as unknown as Decoder
  const { chain, height } = options
  const blockResponse = responses.block.response
  const { hash, header, transactions: decodedTransactions } = decoder.block(
    blockResponse, null /*responses.results?.response*/
  ) as {
    hash: string, header: Block["header"], transactions: Array<Partial<Transaction> & {id: string}>
  }
  const c = chain!;
  const h = (height ? BigInt(height) : undefined)!;
  const block: Block = { id: hash, chain: c, header, responses, height: h, transactions: [], }
  const transactions = decodedTransactions.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
  return Object.assign(block, { transactions })
}
