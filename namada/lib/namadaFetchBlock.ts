import type * as Namada from './namadaTypes.ts'
import { Decode } from '../pkg/fadroma_namada.js'

export function fetchBlock (
  connection: Namada.ConnectionBase,
  parameter?: { height: bigint|number }|{ hash: string }
): Promise<Namada.Block> {
  if (!connection.url) {
    throw new Error("Can't fetch block: missing connection URL")
  }
  if (!parameter) {
    parameter = {} as any
  }
  if ('height' in parameter!) {
    return fetchBlockByHeight(connection, parameter)
  } else if ('hash' in parameter!) {
    throw new Error('NamadaBlock.fetchByHash: not implemented')
  } else {
    return fetchBlockByHeight(connection, {})
  }
}

export function createBlock ({ responses, ...props }: NamadaBlockParameters): Namada.Block {
  throw new Error('todo!')
}

export function createTransaction ({
  hash,
  block,
  ...data
}: Pick<Namada.Transaction, 'hash'|'block'> & Namada.Transaction['data']): Namada.Transaction {
  throw new Error('todo')
}

type NamadaBlockParameters =
  Pick<Namada.Block, 'chain'|'hash'|'header'|'transactions'|'responses'>

/** Responses from block API endpoints. */
export async function fetchBlockByHeight (
  { url, decode, chain }: Namada.ConnectionBase,
  { height }: { height?: number|string|bigint, }
): Promise<Namada.Block> {
  if (!url) {
    throw new Error("Can't fetch block: missing connection URL")
  }
  // Fetch block and results as undecoded JSON
  const blockUrl = `${url}/block?height=${height??''}`
  //const resultsUrl = `${url}/block_results?height=${height??''}`
  const [block/*, results*/] = await Promise.all([
    fetch(blockUrl).then(response=>response.text()),
    //fetch(resultsUrl).then(response=>response.text()),
  ])
  return blockFromResponses({
    block: { url: blockUrl, response: block, },
    //results: { url: resultsUrl, response: results, },
  }, { chain, decode, height })
}

export function blockFromResponses (
  responses: NonNullable<Namada.Block["responses"]>,
  options: { decode?: Namada.Decoder, chain?: Namada.Chain, height?: string|number|bigint }
): Namada.Block {
  const decode = options.decode || Decode as unknown as Namada.Decoder
  const { chain, height } = options
  const blockResponse = responses.block.response
  const { hash, header, transactions: decodedTransactions } = decode.block(
    blockResponse, null /*responses.results?.response*/
  ) as {
    hash:         string,
    header:       Namada.Block["header"]
    transactions: Array<Partial<Namada.Transaction> & {id: string}>
  }
  const block: Namada.Block = {
    chain: chain!,
    hash,
    header,
    responses,
    height: height ? BigInt(height) : undefined,
    transactions: decodedTransactions.map(tx=>({
      hash: tx?.id,
      ...tx,
      chain: chain!,
      get block () { return block }
    })),
  }
  return Object.assign(block, { transactions: decodedTransactions.map(tx=>{
    return {
      hash: tx?.id,
      ...tx,
      get block () { return block }
    } as Namada.Transaction
  }) })
}
