import type * as Namada from './Namada'
import { Decode } from './NamadaDecode'
import { Block, Transaction } from '@fadroma/cw'

type NamadaBlockParameters =
  ConstructorParameters<typeof Block>[0]
  & Pick<NamadaBlock, 'chain'|'hash'|'header'|'transactions'|'responses'>

class NamadaBlock extends Block {
  constructor ({ responses, ...props }: NamadaBlockParameters) {
    super(props)
    this.#responses = responses
  }
  get chain (): Namada.Chain|undefined {
    return super.chain as Namada.Chain|undefined
  }
  #responses?: {
    block:   { url: string, response: string }
    results: { url: string, response: string }
  }
  get responses () {
    return this.#responses
  }
  /** Block header. */
  declare header: NamadaBlockHeader
  /** Timestamp of block */
  get time () {
    return (this.header as any)?.time
  }
  /** Transaction in block. */
  declare transactions: NamadaTransaction[]

  /** Responses from block API endpoints. */
  static async fetchByHeight (
    { url, decode = Decode, chain }: {
      url: string|URL, decode?: typeof Decode, chain?: Namada.Chain
    },
    { height, raw }: {
      height?: number|string|bigint,
      raw?: boolean,
    }
  ): Promise<NamadaBlock> {
    if (!url) {
      throw new Error("Can't fetch block: missing connection URL")
    }
    // Fetch block and results as undecoded JSON
    const blockUrl = `${url}/block?height=${height??''}`
    const resultsUrl = `${url}/block_results?height=${height??''}`
    const [block, results] = await Promise.all([
      fetch(blockUrl).then(response=>response.text()),
      fetch(resultsUrl).then(response=>response.text()),
    ])
    return this.fromResponses({
      block: { url: blockUrl, response: block, },
      results: { url: resultsUrl, response: results, },
    }, { chain, decode, height })
  }

  static async fetchByHash (
    _1: { url: string|URL, decode?: typeof Decode, chain?: Namada.Chain },
    _2: { hash: string, raw?: boolean },
  ): Promise<NamadaBlock> {
    throw new Error('NamadaBlock.fetchByHash: not implemented')
  }

  static fromResponses (
    responses: NonNullable<NamadaBlock["responses"]>,
    { decode = Decode, chain, height, raw = false }: {
      decode?: typeof Decode
      chain?:  Namada.Chain,
      height?: string|number|bigint,
      raw?:    boolean
    },
  ): NamadaBlock {
    const { hash, header, transactions } = decode.block(
      responses.block.response,
      responses.results.response
    ) as {
      hash:         string,
      header:       NamadaBlock["header"]
      transactions: Array<Partial<NamadaTransaction> & {id: string}>
    }
    const props = {
      chain,
      hash,
      header,
      responses,
      transactions: [],
      height: height ? BigInt(height) : undefined
    }
    const block = new NamadaBlock(props)
    return Object.assign(block, {
      transactions: transactions.map(tx=>new NamadaTransaction({
        hash: tx?.id,
        ...tx,
        block
      }))
    })
  }
}

type NamadaBlockHeader = {
  version:            object
  chainId:            string
  height:             bigint
  time:               string
  lastBlockId:        string
  lastCommitHash:     string
  dataHash:           string
  validatorsHash:     string
  nextValidatorsHash: string
  consensusHash:      string
  appHash:            string
  lastResultsHash:    string
  evidenceHash:       string
  proposerAddress:    string
}

type NamadaTransactionParameters =
  Pick<NamadaTransaction, 'hash'|'block'> & NamadaTransaction['data']

class NamadaTransaction extends Transaction {
  constructor ({ hash, block, ...data }: NamadaTransactionParameters) {
    super({ hash, block, data })
  }
  get block (): NamadaBlock|undefined {
    return super.block as NamadaBlock|undefined
  }
  declare data: {
    expiration?: string|null
    timestamp?: string
    feeToken?: string
    feeAmountPerGasUnit?: string
    multiplier?: BigInt
    gasLimitMultiplier?: BigInt
    atomic?: boolean
    txType?: 'Raw'|'Wrapper'|'Decrypted'|'Protocol'
    sections?: object[]
    content?: object
    batch?: Array<{
      hash: string,
      codeHash: string,
      dataHash: string,
      memoHash: string
    }>
  }|undefined
}

export {
  NamadaBlock       as default,
  NamadaTransaction as Transaction,
}
