import type { Tendermint } from '../deps.ts'
import type { ConnectionBase, Chain } from './namada.ts'
import type { Transaction } from './namadaTx.ts'
import type { Decoder } from './namadaDecode.ts'
import { Case } from '../deps.ts'
import { Decode } from '../pkg/fadroma_namada.js'

export type Height = Tendermint.Height

export type Block = Tendermint.Block & {
  readonly chain: Tendermint.ChainRef
  /** Block header. */
  readonly header: BlockHeader
  /** Transaction in block. */
  readonly transactions: Transaction[]
  /** Raw API responses for this block. */
  readonly responses?: BlockResponses
}

export type BlockResponses = {
  readonly block:    { url: string, response: string }
  readonly results?: { url: string, response: string }
}

export type BlockHeader = {
  readonly version:            object
  readonly chainId:            string
  readonly height:             bigint
  readonly time:               string
  readonly lastBlockId:        string
  readonly lastCommitHash:     string
  readonly dataHash:           string
  readonly validatorsHash:     string
  readonly nextValidatorsHash: string
  readonly consensusHash:      string
  readonly appHash:            string
  readonly lastResultsHash:    string
  readonly evidenceHash:       string
  readonly proposerAddress:    string
}

export type BlockResults = {
  readonly height:                string
  readonly txsResults:            TxResult[]|null
  readonly beginBlockEvents:      unknown[]|null
  readonly endBlockEvents:        EndBlockEvent[]|null
  readonly validatorUpdates:      unknown[]|null
  readonly consensusParamUpdates: unknown[]|null
}

export type TxResult = {
  readonly code:       number
  readonly data:       unknown|null
  readonly log:        string
  readonly info:       string
  readonly gas_wanted: string
  readonly gas_used:   string
  readonly events:     unknown[]
  readonly codespace:  string
}

export type EndBlockEvent = {
  readonly type:       string
  readonly attributes: Array<{
    readonly key:      string
    readonly value:    string
    readonly index:    boolean
  }>
}

export const fetchBlock = (
  connection: ConnectionBase,
  parameter?: { height: bigint|number }|{ hash: string }
): Promise<Block> => {
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

type NamadaBlockParameters =
  Pick<Block, 'chain'|'hash'|'header'|'transactions'|'responses'>

/** Responses from block API endpoints. */
export async function fetchBlockByHeight (
  { url, decode, chain }: ConnectionBase,
  { height }: { height?: number|string|bigint, }
): Promise<Block> {
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
  responses: NonNullable<Block["responses"]>,
  options: { decode?: Decoder, chain?: Chain, height?: string|number|bigint }
): Block {
  const decode = options.decode || Decode as unknown as Decoder
  const { chain, height } = options
  const blockResponse = responses.block.response
  const { hash, header, transactions: decodedTransactions } = decode.block(
    blockResponse, null /*responses.results?.response*/
  ) as {
    hash:         string,
    header:       Block["header"]
    transactions: Array<Partial<Transaction> & {id: string}>
  }
  const block: Block = {
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
    } as Transaction
  }) })
}

export async function fetchBlockResults (
  connection: ConnectionBase,
  args?: { height: bigint|number } | { hash: string }
) {
  if (!args || ('height' in args)) {
    return fetchBlockResultsByHeight(connection, args?.height)
  } else if ('hash' in args) {
    throw new Error('fetchBlockResultsByHash: todo')
  } else {
    throw new Error('2nd arg must be { height } or falsy')
  }
}

export async function fetchBlockResultsByHeight (
  { url }: ConnectionBase,
  height?: bigint|number,
): Promise<BlockResults> {
  const response = await fetch(`${url}/block_results?height=${height??''}`)
  const { error, result } = await response.json() as {
    error: {
      data: string
    },
    result: {
      height:                  string
      txs_results:             unknown[]|null
      begin_block_events:      unknown[]|null
      end_block_events:        unknown[]|null
      validator_updated:       unknown[]|null
      consensus_param_updates: unknown[]|null
    },
  }
  if (error) {
    throw new Error(error.data)
  }
  const returned: Partial<BlockResults> = {}
  for (const [key, value] of Object.entries(result)) {
    Object.assign(returned, { [Case.camel(key) as keyof BlockResults]: value as any })
  }
  return returned as BlockResults
}
