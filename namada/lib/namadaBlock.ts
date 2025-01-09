import { Tendermint } from '../deps.ts'
import type { Core } from '../deps.ts'
import type { Chain, ApiDeps } from './namada.ts'
import type { Transaction } from './namadaTx.ts'
import type { Decoder } from './namadaDecode.ts'
/** The height of a Namada block. */
export type Height = Tendermint.Height
/** A Namada block. */
export type Block = Tendermint.Block & {
  readonly chain: Core.ChainRef
  /** Transaction in block. */
  readonly transactions: Transaction[]
}
export const fetchBlock = async (
  api: ApiDeps, options?: { height?: Height, hash?: string, results?: boolean }
): Promise<Block> => {
  const block = Tendermint.fetchBlock(api, options)
  return decodeBlock(api.decoder, api.chain(), 0, "", "")
}
export const decodeBlock = (
  decoder: Decoder, chain: Core.ChainRef, height: Height, block: string, results: string
) => {
  const { hash, header, transactions: decoded } = decoder.block(block, results||null)
  return {
    id: hash,
    chain,
    height: (height ? BigInt(height) : undefined)!,
    header,
    transactions: decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction)),
  }
}
//export const blockFromResponses = (
  //responses: NonNullable<Block["responses"]>,
  //options: { decoder: Decoder, chain?: Chain, height?: string|number|bigint }
//): Block => {
  //const decoder = options.decoder
  //const { chain, height } = options
  //const blockResponse = responses.block.response
  //const { hash, header, transactions: decodedTransactions } = decoder.block(
    //blockResponse, null [>responses.results?.response<]
  //) as {
    //hash: string, header: Block["header"], transactions: Array<Partial<Transaction> & {id: string}>
  //}
  //const c = chain!;
  //const h = (height ? BigInt(height) : undefined)!;
  //const block: Block = { id: hash, chain: c, header, responses, height: h, transactions: [], }
  //const transactions = decodedTransactions.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
  //return Object.assign(block, { transactions })
//}
//export const fetchBlockByHeight = async (
  //{ url, decoder, chain }: ApiDeps,
  //{ height }: { height?: number|string|bigint, }
//): Promise<Block> => {
  //// Fetch block and results as undecoded JSON
  ////const resultsUrl = `${url}/block_results?height=${height??''}`
  //const [block[>, results<]] = await Promise.all([
    //fetch(blockUrl).then(response=>response.text()),
    ////fetch(resultsUrl).then(response=>response.text()),
  //])
  //return blockFromResponses({
    //block: { url: blockUrl, response: block, },
    ////results: { url: resultsUrl, response: results, },
  //}, { chain, decoder, height })
//}
//type BlockDecoder = {
  //block(response: string, _: null): {
    //hash:   Core.Hash,
    //header: Block["header"],
    //transactions: unknown[]
  //}
//}
