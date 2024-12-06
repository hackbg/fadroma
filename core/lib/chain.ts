/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
//import { Logged, bold, colors, randomColor } from './Util.ts'
//import { fetchBalance } from './dlt/Bank.ts'
//import { Contract, fetchCodeInstances, query } from './compute/Contract.ts'
//import { UploadedCode, fetchCodeInfo, } from './compute/Upload.ts'
//import type { Address, Agent, ChainId, CodeId, Identity, Message, Uint128 } from '../index.ts'

//abstract class Chain extends Logged {

  //static get Connection () {
    //return Connection
  //}

  //constructor (
    //properties: ConstructorParameters<typeof Logged>[0]
      //& Pick<Chain, 'chainId'>
      //& Partial<Pick<Chain, 'blockInterval'>>
  //) {
    //super(properties||{})
    //this.chainId = properties.chainId
  //}

  /** Chain ID. This is a string that uniquely identifies a chain.
    * A project's mainnet and testnet have different chain IDs. */
  //chainId: ChainId
  //get id () {
    //return this.chainId
  //}

  //[>* Time to ping for next block. <]
  //blockInterval = 250

  //[>* Get a read-only connection to the API endpoint. <]
  //abstract getConnection (): Connection

  //[>* Authenticate to the chain, obtaining an Agent instance that can send transactions. <]
  //abstract authenticate (properties?: { mnemonic: string }|Identity): Promise<Agent>

  //[>* Get the current block height. <]
  //fetchHeight (): Promise<bigint> {
    //this.log.debug('Querying block height')
    //return this.getConnection().fetchHeightImpl()
  //}

  //[>* Wait until the block height increments, or until `this.alive` is set to false. <]
  //fetchNextBlock (): Promise<bigint> {
    //this.log.debug('Querying block height')
    //return fetchNextBlock(this)
  //}

  //[>* Get info about the latest block. <]
  //fetchBlock ():
    //Promise<Block>
  //[>* Get info about the block with a specific height. <]
  //fetchBlock ({ height }: { height: number|bigint, raw?: boolean }):
    //Promise<Block>
  //[>* Get info about the block with a specific hash. <]
  //fetchBlock ({ hash }: { hash: string, raw?: boolean }):
    //Promise<Block>
  //fetchBlock (...args: unknown[]): Promise<Block> {
    //return fetchBlock(this, ...args as Parameters<Chain["fetchBlock"]>)
  //}

  //[>* Fetch balance of 1 or many addresses in 1 or many native tokens. <]
  //fetchBalance (address: Address, token: string):
    //Promise<Uint128>
  //fetchBalance (address: Address, tokens?: string[]):
    //Promise<Record<string, Uint128>>
  //fetchBalance (addresses: Address[], token: string):
    //Promise<Record<Address, Uint128>>
  //fetchBalance (addresses: Address[], tokens?: string):
    //Promise<Record<Address, Record<string, Uint128>>>
  //async fetchBalance (...args: unknown[]): Promise<unknown> {
    //return fetchBalance(this, ...args as Parameters<Chain["fetchBalance"]>)
  //}

  //[>* Fetch info about all code IDs uploaded to the chain. <]
  //fetchCodeInfo ():
    //Promise<Record<CodeId, UploadedCode>>
  //[>* Fetch info about a single code ID. <]
  //fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    //Promise<UploadedCode>
  //[>* Fetch info about multiple code IDs. <]
  //fetchCodeInfo (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    //Promise<Record<CodeId, UploadedCode>>
  //fetchCodeInfo (...args: unknown[]): Promise<unknown> {
    //return fetchCodeInfo(this, ...args as Parameters<Chain["fetchCodeInfo"]>)
  //}

  //[>* Fetch all instances of a code ID. <]
  //fetchCodeInstances (
    //codeId: CodeId
  //): Promise<Record<Address, Contract>>
  //[>* Fetch all instances of a code ID, with custom client class. <]
  //fetchCodeInstances <C extends typeof Contract> (
    //Contract: C,
    //codeId: CodeId
  //): Promise<Record<Address, InstanceType<C>>>
  //[>* Fetch all instances of multple code IDs. <]
  //fetchCodeInstances (
    //codeIds:  Iterable<CodeId>,
    //options?: { parallel?: boolean }
  //): Promise<Record<CodeId, Record<Address, Contract>>>
  //[>* Fetch all instances of multple code IDs, with custom client class. <]
  //fetchCodeInstances <C extends typeof Contract> (
    //Contract: C,
    //codeIds:  Iterable<CodeId>,
    //options?: { parallel?: boolean }
  //): Promise<Record<CodeId, Record<Address, InstanceType<C>>>>
  //[>* Fetch all instances of multple code IDs, with multiple custom client classes. <]
  //fetchCodeInstances (
    //codeIds:  { [id: CodeId]: typeof Contract },
    //options?: { parallel?: boolean }
  //): Promise<{
    //[codeId in keyof typeof codeIds]: Record<Address, InstanceType<typeof codeIds[codeId]>>
  //}>
  //async fetchCodeInstances (...args: unknown[]): Promise<unknown> {
    //return fetchCodeInstances(this, ...args as Parameters<Chain["fetchCodeInstances"]>)
  //}

  //[>* Fetch a contract's details wrapped in a `Contract` instance. <]
  //fetchContractInfo (
    //address:   Address
  //): Promise<Contract>
  //[>* Fetch a contract's details wrapped in a custom class instance. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //address:   Address
  //): Promise<InstanceType<T>>
  //[>* Fetch multiple contracts' details wrapped in `Contract` instance. <]
  //fetchContractInfo (
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, Contract>>
  //[>* Fetch multiple contracts' details wrapped in instances of a custom class. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, InstanceType<T>>>
  //[>* Fetch multiple contracts' details, specifying a custom class for each. <]
  //fetchContractInfo (
    //contracts: { [address: Address]: typeof Contract },
    //options?:  { parallel?: boolean }
  //): Promise<{
    //[address in keyof typeof contracts]: InstanceType<typeof contracts[address]>
  //}>
  //async fetchContractInfo (...args: unknown[]): Promise<unknown> {
    //return fetchCodeInstances(this, ...args as Parameters<Chain["fetchContractInfo"]>)
  //}

  //[>* Query a contract by address. <]
  //query <T> (contract: Address, message: Message):
    //Promise<T>
  //[>* Query a contract object. <]
  //query <T> (contract: { address: Address }, message: Message):
    //Promise<T>
  //query <T> (...args: unknown[]): Promise<unknown> {
    //return query(this, ...args as Parameters<Chain["query"]>)
  //}
//}

/** Represents a remote API endpoint.
  *
  * * Use one of its subclasses in `@fadroma/scrt`, `@fadroma/cw`, `@fadroma/namada`
  *   to connect to the corresponding chain.
  * * Or, extend this class to implement support for new kinds of blockchains. */
export abstract class Connection extends Logged {
  constructor (
    properties: ConstructorParameters<typeof Logged>[0]
      & Pick<Connection, 'chain'|'url'>
      & Partial<Pick<Connection, 'alive'>>
  ) {
    super(properties)
    this.#chain = properties.chain
    this.url    = properties.url
    this.alive  = properties.alive ?? true
    this.log.label = [
      this.constructor.name,
      '(', this[Symbol.toStringTag] ? `(${bold(this[Symbol.toStringTag])})` : null, ')'
    ].filter(Boolean).join('')
    this.log.label = new.target.constructor.name
    const chainColor = randomColor({ luminosity: 'dark', seed: this.url })
    this.log.label = colors.bgHex(chainColor).whiteBright(` ${this.url} `)
  }
  get [Symbol.toStringTag] () {
    if (this.url) {
      const color = randomColor({ luminosity: 'dark', seed: this.url })
      return colors.bgHex(color).whiteBright(this.url)
    }
  }
  #chain: Chain
  /** Chain to which this connection points. */
  get chain (): Chain {
    return this.#chain
  }
  /** ID of chain to which this connection points. */
  get chainId (): ChainId {
    return this.chain.chainId
  }
  /** Connection URL.
    *
    * The same chain may be accessible via different endpoints, so
    * this property contains the URL to which requests are sent. */
  url:   string
  /** Setting this to false stops retries. */
  alive: boolean = true

  /** Chain-specific implementation of fetchBlock. */
  abstract fetchBlockImpl (parameters?:
    { raw?: boolean } & ({ height: number|bigint }|{ hash: string })
  ): Promise<Block>
  /** Chain-specific implementation of fetchHeight. */
  abstract fetchHeightImpl ():
    Promise<bigint>
  /** Chain-specific implementation of fetchBalance. */
  abstract fetchBalanceImpl (parameters: {
    addresses: Record<Address, string[]>,
    parallel?: boolean
  }): Promise<Record<Address, Record<string, Uint128>>>
  /** Chain-specific implementation of fetchCodeInfo. */
  abstract fetchCodeInfoImpl (parameters?: {
    codeIds?:  CodeId[]
    parallel?: boolean
  }): Promise<Record<CodeId, UploadedCode>>
  /** Chain-specific implementation of fetchCodeInstances. */
  abstract fetchCodeInstancesImpl (parameters: {
    codeIds:   { [id: CodeId]: typeof Contract },
    parallel?: boolean
  }): Promise<{
    [codeId in keyof typeof parameters["codeIds"]]:
      Record<Address, InstanceType<typeof parameters["codeIds"][codeId]>>
  }>
  /** Chain-specific implementation of fetchContractInfo. */
  abstract fetchContractInfoImpl (parameters: {
    contracts: { [address: Address]: typeof Contract },
    parallel?: boolean
  }): Promise<Record<Address, Contract>>
  /** Chain-specific implementation of query. */
  abstract queryImpl <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
  }): Promise<T>
}

/** The building block of a blockchain, as obtained by
  * [the `fetchBlock` method of `Connection`](#method-connectionfetchblock)
  *
  * Contains zero or more transactions. */
export abstract class Block {
  constructor (properties: Pick<Block, 'hash'|'chain'|'header'|'height'|'transactions'>) {
    const height = properties?.height ?? properties?.header?.height
    if (!height) {
      throw new Error("Can't construct Block without at least specifying height")
    }
    this.#chain       = properties?.chain
    this.hash         = properties?.hash
    this.header       = properties?.header
    this.height       = BigInt(height)
    this.transactions = properties?.transactions || []
  }
  /** Private reference to chain to which this block belongs. */
  readonly #chain?: Chain
  /** Chain to which this block belongs. */
  get chain () { return this.#chain }
  /** ID of chain to which this block belongs. */
  get chainId () { return this.chain?.id }
  /** Unique ID of block. */
  readonly hash?: string
  /** Unique ID of block. */
  get id () { return this.hash }
  /** Unique identifying hash of block. */
  readonly height?: bigint
  /** Contents of block header. */
  readonly header?: { height?: string|number|bigint }
  /** Transactions in block */
  readonly transactions?: Transaction[] = []
}

/** A transaction in a block on a chain. */
export class Transaction {
  constructor (properties: Pick<Transaction, 'hash'|'block'|'data'>) {
    this.#block = properties?.block
    this.hash   = properties?.hash
    this.data   = properties?.data
  }
  readonly #block?: Block
  /** Block to which this transaction belongs. */
  get block () { return this.#block }
  /** Hash of block to which this transaction belongs. */
  get blockHash () { return this.block?.hash }
  /** Height of block to which this transaction belongs. */
  get blockHeight () { return this.block?.height }
  /** Chain to which this transaction belongs. */
  get chain () { return this.block?.chain }
  /** ID of chain to which this transaction belongs. */
  get chainId () { return this.block?.chain?.id }
  /** Unique identifying hash of transaction. */
  readonly hash?: string
  /** Unique ID of block. */
  get id () { return this.hash }
  /** Any custom data attached to the transaction. */
  readonly data?: unknown
}

/** Implementation of Connection#fetchBlock -> Connection#fetchBlockImpl */
export async function fetchBlock (chain: Chain, ...args: Parameters<Chain["fetchBlock"]>):
  Promise<Block>
{
  if (args[0]) {
    if (typeof args[0] === 'object') {
      if ('height' in args[0] && !!args[0].height) {
        chain.log.debug(`Fetching block with height ${args[0].height}`)
        return chain.getConnection().fetchBlockImpl({
          raw:    args[0].raw,
          height: BigInt(args[0].height as number)
        })
      } else if ('hash' in args[0] && !!args[0].hash) {
        chain.log.debug(`Fetching block with hash ${args[0].hash}`)
        return chain.getConnection().fetchBlockImpl({
          raw:  args[0].raw,
          hash: args[0].hash as string,
        })
      }
    } else {
      throw new Error('Invalid arguments, pass {height:number} or {hash:string}')
    }
  }
  chain.log.debug(`Fetching latest block`)
  return chain.getConnection().fetchBlockImpl()
}

/** Implementation of Chain#fetchNextBlock -> Connection#fetchNextBlockImpl */
export async function fetchNextBlock (chain: Chain):
  Promise<bigint>
{
  return chain.fetchHeight().then(async startingHeight=>{
    startingHeight = BigInt(startingHeight)
    chain.log.log(
      `Waiting for block > ${bold(String(startingHeight))}`,
      `(polling every ${chain.blockInterval}ms)`
    )
    const t = + new Date()
    return new Promise(async (resolve, reject)=>{
      try {
        while (chain.getConnection().alive) {
          await new Promise(ok=>setTimeout(ok, chain.blockInterval))
          chain.log(
            `Waiting for block > ${bold(String(startingHeight))} ` +
            `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
          )
          const height = await chain.fetchHeight()
          if (height > startingHeight) {
            chain.log.log(`Block height incremented to ${bold(String(height))}, proceeding`)
            return resolve(BigInt(height as unknown as number))
          }
        }
        throw new Error('endpoint dead, not waiting for next block')
      } catch (e) {
        reject(e)
      }
    })
  })
}

