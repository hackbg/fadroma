/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
import { ContractInstance } from './deploy'
import { Error, Logged, colors, bold, randomColor, into } from './core'
import { assign, Console } from './core'
import * as Code from './program'
import * as Deploy from './deploy'
import * as Token from './token'
import * as Store from './store'

import { CompiledCode } from './program.browser'
/** The `CompiledCode` class has an alternate implementation for non-browser environments.
  * This is because Next.js tries to parse the dynamic `import('node:...')` calls used by
  * the `fetch` methods. (Which were made dynamic exactly to avoid such a dual-implementation
  * situation in the first place - but Next is smart and adds a problem where there isn't one.)
  * So, it defaults to the version that can only fetch from URL using the global fetch method;
  * but the non-browser entrypoint substitutes `CompiledCode` in `_$_HACK_$_` with the
  * version which can also load code from disk (`LocalCompiledCode`). Ugh. */
export const _$_HACK_$_ = { CompiledCode }

export type ChainId = string

/** An address on a chain. */
export type Address = string

/** A contract's full unique on-chain label. */
export type Label = string

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

export class Identity extends Logged {
  /** Display name. */
  name?: Address
  /** Unique identifier. */
  address?: Address

  constructor (properties?: Partial<Identity>) {
    super(properties)
    assign(this, properties, ['name', 'address'])
  }

  sign (doc: any): unknown {
    throw new Error("can't sign: stub")
  }
}

export abstract class Endpoint extends Logged {
  /** Chain ID. */
  chainId?: ChainId
  /** Setting this to false stops retries. */
  alive: boolean = true
  /** Connection URL. */
  url?: string
  /** Platform SDK. */
  api?: unknown

  constructor (properties: Partial<Endpoint> = {}) {
    super(properties)
    assign(this, properties, ['chainId', 'alive', 'url', 'api'])
    this.log.label = [
      this.constructor.name,
      '(',
      this[Symbol.toStringTag] ? `(${bold(this[Symbol.toStringTag])})` : null,
      ')'
    ].filter(Boolean).join('')
  }

  get [Symbol.toStringTag] () {
    let tag = ''
    if (this.chainId) {
      tag = colors.bgHex(randomColor({ luminosity: 'dark', seed: this.chainId })).whiteBright(this.chainId)
    }
    return tag
  }
}

export abstract class Connection extends Endpoint {
  /** Native token of chain. */
  static gasToken: Token.Native = new Token.Native('')
  /** Native token of chain. */
  static gas (amount: number|Token.Uint128): Token.Amount {
    return this.gasToken.amount(String(amount))
  }
  /** Signer identity. */
  identity?: Identity
  /** Default transaction fees. */
  fees?: { send?: Token.IFee, upload?: Token.IFee, init?: Token.IFee, exec?: Token.IFee }

  constructor (properties: Partial<Connection> = {}) {
    super(properties)
    assign(this, properties, ['identity', 'fees'])
    this.log.label = new.target.constructor.name
    const chainColor = randomColor({ // url takes priority in determining color
      luminosity: 'dark', seed: this.chainId||this.url
    })
    this.log.label = colors.bgHex(chainColor).whiteBright(` ${this.chainId||this.url} `)
    if ((this.identity && (this.identity.name||this.identity.address))) {
      const identityColor = randomColor({ // address takes priority in determining color
        luminosity: 'dark', seed: this.identity.address||this.identity.name
      })
      this.log.label += ' '
      this.log.label += colors.bgHex(identityColor).whiteBright(
        ` ${this.identity.name||this.identity.address} `
      )
    }
  }

  get [Symbol.toStringTag] () {
    let tag = super[Symbol.toStringTag]
    if ((this.identity && (this.identity.name||this.identity.address))) {
      let myTag = `${this.identity.name||this.identity.address}`
      const myColor = randomColor({ luminosity: 'dark', seed: myTag })
      myTag = colors.bgHex(myColor).whiteBright.bold(myTag)
      tag = [tag, myTag].filter(Boolean).join(':')
    }
    return tag
  }

  get address (): Address|undefined {
    return this.identity?.address
  }

  get defaultDenom (): string {
    return (this.constructor as Function & {gasToken: Token.Native}).gasToken?.id
  }

  /** Time to ping for next block. */
  blockInterval = 250

  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    return this.height.then(async startingHeight=>{
      startingHeight = Number(startingHeight)
      if (isNaN(startingHeight)) {
        this.log.warn('Current block height undetermined. Not waiting for next block')
        return Promise.resolve(NaN)
      }
      this.log.log(
        `Waiting for block > ${bold(String(startingHeight))}`,
        `(polling every ${this.blockInterval}ms)`
      )
      const t = + new Date()
      return new Promise(async (resolve, reject)=>{
        try {
          while (this.alive) {
            await new Promise(ok=>setTimeout(ok, this.blockInterval))
            this.log(
              `Waiting for block > ${bold(String(startingHeight))} ` +
              `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
            )
            const height = await this.height
            if (height > startingHeight) {
              this.log.log(`Block height incremented to ${bold(String(height))}, proceeding`)
              return resolve(height as number)
            }
          }
          throw new Error('endpoint dead, not waiting for next block')
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  abstract doGetHeight (): Promise<number>

  get height (): Promise<number> {
    this.log.debug('Querying block height')
    return this.doGetHeight()
  }

  abstract doGetBlockInfo (block?: number): Promise<unknown>

  getBlock (block?: number): Promise<unknown> {
    this.log.debug('Querying block info')
    return this.doGetBlockInfo(block)
  }

  get block (): Promise<unknown> {
    return this.getBlock()
  }

  /** Get the code id of a given address. */
  getCodeId (contract: Address|{ address: Address }): Promise<Deploy.CodeId> {
    const address = (typeof contract === 'string') ? contract : contract.address
    this.log.debug(`Querying code ID of ${bold(address)}`)
    return timed(
      this.doGetCodeId.bind(this, address),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}: ${bold(address)} is code id ${bold(result)}`
      )
    )
  }

  abstract doGetCodeId (
    contract: Address
  ): Promise<Deploy.CodeId>

  /** Get the code hash of a given code id. */
  getCodeHashOfCodeId (contract: Deploy.CodeId|{ codeId: Deploy.CodeId }): Promise<Code.CodeHash> {
    const codeId = (typeof contract === 'object') ? contract.codeId : contract
    this.log.debug(`Querying code hash of code id ${bold(codeId)}`)
    return timed(
      this.doGetCodeHashOfCodeId.bind(this, codeId),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}: code hash of code id ${bold(codeId)} is ${bold(result)}`
      )
    )
  }

  abstract doGetCodeHashOfCodeId (
    codeId: Deploy.CodeId
  ): Promise<Code.CodeHash>

  /** Get the code hash of a given address. */
  getCodeHashOfAddress (contract: Address|{ address: Address }): Promise<Code.CodeHash> {
    const address = (typeof contract === 'string') ? contract : contract.address
    this.log.debug(`Querying code hash of address ${bold(address)}`)
    return timed(
      this.doGetCodeHashOfAddress.bind( this, address),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}: code hash of address ${bold(address)} is ${bold(result)}`
      )
    )
  }

  abstract doGetCodeHashOfAddress (
    contract: Address
  ): Promise<Code.CodeHash>

  /** Get a client handle for a specific smart contract, authenticated as as this agent. */
  getContract (
    options: Address|{ address: Address }): Contract
  getContract <C extends typeof Contract> (
    options: Address|{ address: Address }, $C: C = Contract as C, 
  ): InstanceType<C> {
    if (typeof options === 'string') {
      options = { address: options }
    }
    return new $C({
      instance: options,
      connection: this
    }) as InstanceType<C>
  }

  getCodes (): Promise<Record<Deploy.CodeId, Deploy.UploadedCode>> {
    this.log.debug('Querying all codes...')
    return this.doGetCodes()
  }

  abstract doGetCodes (): Promise<Record<Deploy.CodeId, Deploy.UploadedCode>>

  /** Get client handles for all contracts that match a code ID */
  getContractsByCodeId (
    id: Deploy.CodeId): Promise<Record<Address, Contract>>
  getContractsByCodeId <C extends typeof Contract> (
    id: Deploy.CodeId, $C: C): Promise<Record<Address, InstanceType<C>>>
  getContractsByCodeId <C extends typeof Contract> (
    id: Deploy.CodeId, $C: C = Contract as C
  ): Promise<Record<Address, InstanceType<C>>> {
    this.log.debug(`Querying contracts with code id ${id}...`)
    return this.doGetContractsByCodeId(id).then(contracts=>{
      const results: Record<Address, InstanceType<C>> = {}
      for (const instance of contracts) {
        results[instance.address] = new $C({ instance, connection: this }) as InstanceType<C>
      }
      return results
    })
  }

  abstract doGetContractsByCodeId (
    id: Deploy.CodeId
  ): Promise<Iterable<{ address: Address }>>

  /** Get client handles for all contracts that match multiple code IDs */
  getContractsByCodeIds (
    ids: Iterable<Deploy.CodeId>): Promise<Record<Deploy.CodeId, Record<Address, Contract>>>
  getContractsByCodeIds <C extends typeof Contract> (
    ids: Iterable<Deploy.CodeId>, $C?: C): Promise<Record<Deploy.CodeId, Record<Address, InstanceType<C>>>>
  getContractsByCodeIds <C extends typeof Contract> (
    ids: Record<Deploy.CodeId, C>): Promise<Record<Deploy.CodeId, Record<Address, InstanceType<C>>>>
  async getContractsByCodeIds (...args: any[]) {
    if (!args[0]) {
      throw new Error('Invalid arguments. Pass Deploy.CodeId[] or Record<Deploy.CodeId, typeof Contract>')
    }
    const result: Record<Deploy.CodeId, Record<Address, Contract>> = {}
    if (args[0][Symbol.iterator]) {
      this.log.debug(`Querying contracts with code ids ${[...args[0]].join(', ')}...`)
      for (const codeId of args[0]) {
        result[codeId] = await this.getContractsByCodeId(codeId, args[1])
      }
    } else {
      this.log.debug(`Querying contracts with code ids ${Object.keys(args[0]).join(', ')}...`)
      for (const [codeId, $C] of Object.entries(args[0])) {
        result[codeId] = await this.getContractsByCodeId(codeId, args[1])
      }
    }
    return {}
  }

  get balance () {
    if (!this.identity?.address) {
      throw new Error('not authenticated, use .getBalance(token, address)')
    } else if (!this.defaultDenom) {
      throw new Error('no default token for this chain, use .getBalance(token, address)')
    } else {
      return this.getBalanceOf(this.identity.address)
    }
  }

  /** Get the balance in a native token of a given address,
    * either in this connection's gas token,
    * or in another given token. */
  getBalanceOf (address: Address|{ address: Address }, token?: string) {
    if (!address) {
      throw new Error('pass (address, token?) to getBalanceOf')
    }
    token ??= this.defaultDenom
    if (!token) {
      throw new Error('no token for balance query')
    }
    const addr = (typeof address === 'string') ? address : address.address
    if (addr === this.identity?.address) {
      this.log.debug('Querying', bold(token), 'balance')
    } else {
      this.log.debug('Querying', bold(token), 'balance of', bold(addr))
    }
    return timed(
      this.doGetBalance.bind(this, token, addr),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${elapsed}s: ${bold(address)} has ${bold(result)} ${token}`
      )
    )
  }

  /** Get the balance in a given native token, of
    * either this connection's identity's address,
    * or of another given address. */
  getBalanceIn (token: string, address?: Address|{ address: Address }) {
    if (!token) {
      throw new Error('pass (token, address?) to getBalanceIn')
    }
    address ??= this.identity?.address
    if (!address) {
      throw new Error('no address for balance query')
    }
    const addr = (typeof address === 'string') ? address : address.address
    if (addr === this.identity?.address) {
      this.log.debug('Querying', bold(token), 'balance')
    } else {
      this.log.debug('Querying', bold(token), 'balance of', bold(addr))
    }
    return timed(
      this.doGetBalance.bind(this, token, addr),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${elapsed}s: balance of ${bold(address)} is ${bold(result)}`
      )
    )
  }

  abstract doGetBalance (
    token?: string, address?: string
  ): Promise<string|number|bigint>

  /** Query a contract. */
  async query <Q> (contract: Address|{ address: Address }, message: Message): Promise<Q> {
    const _contract = (typeof contract === 'string') ? { address: contract } : contract
    const result = await timed(
      ()=>this.doQuery(_contract, message),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}s: `, JSON.stringify(result)
      )
    )
    return result as Q
  }

  abstract doQuery (
    contract: { address: Address }, message: Message
  ): Promise<unknown>

  /** Send native tokens to 1 recipient. */
  async send (
    recipient: Address|{ address?: Address },
    amounts: (Token.Amount|Token.ICoin)[],
    options?: { sendFee?: Token.IFee, sendMemo?: string }
  ): Promise<unknown> {
    if (typeof recipient === 'object') {
      recipient = recipient.address!
    }
    if (!recipient) {
      throw new Error('no recipient address')
    }
    this.log.debug(
      `Sending to ${bold(recipient)}:`,
      ` ${amounts.map(x=>x.toString()).join(', ')}`
    )
    return await timed(
      ()=>this.doSend(recipient as string, amounts.map(
        amount=>(amount instanceof Token.Amount)?amount.asCoin():amount
      ), options),
      t=>`Sent in ${bold(t)}s`
    )
  }

  abstract doSend (
    recipient: Address, amounts: Token.ICoin[], options?: Parameters<Connection["send"]>[2]
  ): Promise<unknown>

  abstract doSendMany (
    outputs: [Address, Token.ICoin[]][], options?: unknown
  ): Promise<unknown>

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<Code.CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: Store.UploadStore,
      uploadFee?:   Token.ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<Deploy.UploadedCode & { chainId: ChainId, codeId: Deploy.CodeId }> {

    let template: Uint8Array
    if (code instanceof Uint8Array) {
      template = code
    } else {
      if (typeof code === 'string' || code instanceof URL) {
        code = new _$_HACK_$_.CompiledCode({ codePath: code })
      } else {
        code = new _$_HACK_$_.CompiledCode(code)
      }
      const t0 = performance.now()
      template = await (code as Code.CompiledCode).fetch()
      const t1 = performance.now() - t0
      this.log.log(
        `Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
        bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
      )
    }

    this.log.debug(`Uploading ${bold((code as any).codeHash)}`)
    const result = await timed(
      this.doUpload.bind(this, template, options),
      ({elapsed, result}: any) => this.log.debug(
        `Uploaded in ${bold(elapsed)}:`,
        `code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
      ))

    return new Deploy.UploadedCode({
      ...template, ...result as any
    }) as Deploy.UploadedCode & {
      chainId: ChainId, codeId: Deploy.CodeId,
    }

  }

  abstract doUpload (
    data: Uint8Array, options: Parameters<Connection["upload"]>[1]
  ): Promise<Partial<Deploy.UploadedCode>>

  /** Instantiate a new program from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   Deploy.ContractInstance with no `address` populated yet.
    *   This will be populated after executing the batch. */
  async instantiate (
    contract: Deploy.CodeId|Partial<Deploy.UploadedCode>,
    options:  Partial<Deploy.ContractInstance>
  ): Promise<Deploy.ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new Deploy.UploadedCode({ codeId: contract })
    }
    if (isNaN(Number(contract.codeId))) {
      throw new Error(`can't instantiate contract with missing code id: ${contract.codeId}`)
    }
    if (!contract.codeId) {
      throw new Error("can't instantiate contract without code id")
    }
    if (!options.label) {
      throw new Error("can't instantiate contract without label")
    }
    if (!(options.initMsg||('initMsg' in options))) {
      throw new Error("can't instantiate contract without init message")
    }
    const { codeId, codeHash } = contract
    const result = await timed(
      () => into(options.initMsg).then(initMsg=>this.doInstantiate(codeId, {
        codeHash, ...options, initMsg
      })),
      ({ elapsed, result }) => this.log.debug(
        `Instantiated in ${bold(elapsed)}:`,
        `code id ${bold(String(codeId))} as `,
        `${bold(options.label)} (${result.address})`
      )
    )
    return new Deploy.ContractInstance({
      ...options, ...result
    }) as Deploy.ContractInstance & {
      address: Address
    }
  }

  abstract doInstantiate (
    codeId: Deploy.CodeId, options: Partial<Deploy.ContractInstance>
  ): Promise<Partial<Deploy.ContractInstance>>

  /** Call a given program's transaction method. */
  async execute (
    contract: Address|Partial<Deploy.ContractInstance>,
    message:  Message,
    options?: { execFee?: Token.IFee, execSend?: Token.ICoin[], execMemo?: string }
  ): Promise<unknown> {
    if (typeof contract === 'string') {
      contract = new Deploy.ContractInstance({ address: contract })
    }
    if (!contract.address) {
      throw new Error("agent.execute: no contract address")
    }
    const { address } = contract
    let method = (typeof message === 'string') ? message : Object.keys(message||{})[0]
    return timed(
      () => this.doExecute(contract as { address: Address }, message, options),
      ({ elapsed }) => this.log.debug(
        `Executed in ${bold(elapsed)}:`,
        `tx ${bold(method||'(???)')} of ${bold(address)}`
      )
    )
  }

  abstract doExecute (
    contract: { address: Address }, message: Message, options: Parameters<Connection["execute"]>[2]
  ): Promise<unknown>

  /** Construct a transaction batch. */
  batch (): Batch<typeof this> {
    return new Batch({ connection: this })
  }
}

async function timed <T> (
  fn: ()=>Promise<T>, cb: (ctx: { elapsed: string, result: T })=>unknown
): Promise<T> {
  const t0 = performance.now()
  const result = await fn()
  const t1 = performance.now()
  cb({
    elapsed: ((t1-t0)/1000).toFixed(3)+'s',
    result
  })
  return result
}

/** Contract: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Contract extends Logged {
  instance?: { address?: Address }
  connection?: Connection
  constructor (properties: Address|Partial<Contract>) {
    super((typeof properties === 'string')?{}:properties)
    if (typeof properties === 'string') {
      properties = { instance: { address: properties } }
    }
    assign(this, properties, [ 'instance', 'connection' ])
    let { instance, connection } = properties
    this.instance = instance as Partial<Deploy.ContractInstance>
    this.connection = connection
  }
  /** Execute a query on the specified instance as the specified Connection. */
  query <Q> (message: Message): Promise<Q> {
    if (!this.connection) {
      throw new Error("can't query instance without connection")
    }
    if (!this.instance?.address) {
      throw new Error("can't query instance without address")
    }
    return this.connection.query<Q>(
      this.instance as Deploy.ContractInstance & { address: Address }, message
    )
  }
  /** Execute a transaction on the specified instance as the specified Connection. */
  execute (message: Message, options: Parameters<Connection["execute"]>[2] = {}): Promise<unknown> {
    if (!this.connection) {
      throw new Error("can't transact with instance without connection")
    }
    if (!this.connection.execute) {
      throw new Error("can't transact with instance without authorizing the connection")
    }
    if (!this.instance?.address) {
      throw new Error("can't transact with instance without address")
    }
    return this.connection.execute(
      this.instance as Deploy.ContractInstance & { address: Address }, message, options
    )
  }
}

export abstract class Backend extends Logged {
  /** The chain ID that will be passed to the devnet node. */
  chainId?:  ChainId
  /** Denomination of base gas token for this chain. */
  gasToken?: Token.Native

  constructor (properties?: Partial<Backend>) {
    super(properties)
    assign(this, properties, ["chainId"])
  }

  abstract connect (parameter?: string|Partial<Identity>): Promise<Connection>

  abstract getIdentity (name: string): Promise<{ address?: Address, mnemonic?: string }>
}

/** Builder object for batched transactions. */
export class Batch<C extends Connection> extends Logged {
  connection?: C

  constructor (properties?: Partial<Batch<C>>) {
    super(properties)
  }
  /** Add an upload message to the batch. */
  upload (...args: Parameters<C["upload"]>): this {
    this.log.warn('upload: stub (not implemented)')
    return this
  }
  /** Add an instantiate message to the batch. */
  instantiate (...args: Parameters<C["instantiate"]>): this {
    this.log.warn('instantiate: stub (not implemented)')
    return this
  }
  /** Add an execute message to the batch. */
  execute (...args: Parameters<C["execute"]>): this {
    this.log.warn('execute: stub (not implemented)')
    return this
  }
  /** Submit the batch. */
  async submit (...args: unknown[]): Promise<unknown> {
    this.log.warn('submit: stub (not implemented)')
    return {}
  }
}
