import { Tendermint } from '../deps.ts'
import { Error } from './namadaLog.ts'
import type { Deps } from './namada.ts'
import type { Transaction } from './namadaTx.ts'
/** The height of a Namada block. */
export type Height = Tendermint.Height
/** A Namada block. */
export type Block = Tendermint.Block & { readonly transactions: Transaction[] }
export const fetchBlock = async (
  api: Deps, options?: { height?: Height, hash?: string, results?: boolean, raw?: boolean }
): Promise<Block> => {
  const result      = await Tendermint.fetchBlock(api, { ...options, raw: true })
  const blockData   = result.responses!.block!.data!
  const resultsData = options?.results ? result.responses!.results!.data! : ""
  const decoded     = decodeBlock(api, result.height, blockData, resultsData)
  if (options?.raw) Object.assign(decoded, { responses: result.responses })
  return decoded as Block
}
export const decodeBlock = (
  { log, decoder, chain }: Deps,
  h:       Height,
  block:   string,
  results: string,
) => {
  const height = (typeof h === 'bigint') ? h : (isNaN(Number(h)) ? undefined : BigInt(h!))
  if (!height) {
    log.error('could not detect block height in', block)
    throw new Error('could not detect block height', { block })
  }
  try {
    const { hash: id, header, transactions: decoded } = decoder.block(block, results||null)
    const transactions = decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
    return { chain: chain(), id, height, header, transactions }
  } catch (e: any) {
    log.error('failed to decode block:', { block, results })
    throw Object.assign(e, { block, results })
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
  //{ url, decoder, chain }: Deps,
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
