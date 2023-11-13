import { Console, bold, into } from './base'
import type { Address, Message } from './base'
import * as Code from './code'
import * as Deploy from './deploy'
import type * as Token from './token'
import type * as Store from './store'

export type FOO = 'foo'
export type BAR = 'bar'

class Foo<A> {}

class Bar<A> { constructor (x: Foo<A>) {} }

new Bar<BAR>(new Foo<FOO>)

export type Mode = 'mainnet'|'testnet'|'devnet'|'mocknet'

export type ChainId = string

export abstract class Connection {
  log = new Console(this.constructor.name)

  endpoint: Endpoint
  identity?: Identity
  fees?: { send?: Token.IFee, upload?: Token.IFee, init?: Token.IFee, exec?: Token.IFee }
  constructor (properties: Partial<Connection> = {}) {
    if (!properties.endpoint) {
      throw new Error('no endpoint')
    }
    this.endpoint = properties.endpoint
    this.identity = properties.identity
    this.fees = properties.fees || this.fees
  }

  protected async timed <T> (
    fn: ()=>Promise<T>,
    cb: (elapsed: string, result: T)=>string
  ): Promise<T> {
    const t0 = performance.now()
    const result = await fn()
    const t1 = performance.now()
    this.log.debug(cb(((t1-t0)/1000).toFixed(3)+'s', result))
    return result
  }

  abstract getCodeId (
    contract: Address
  ): Promise<Code.CodeId>

  abstract getCodeHashOfCodeId (
    codeId: Code.CodeId
  ): Promise<Code.CodeHash>

  abstract getCodeHashOfAddress (
    contract: Address
  ): Promise<Code.CodeHash>

  /** Get a client handle for a specific smart contract, authenticated as as this agent. */
  getContract (
    options: Address|{ address: Address }): ContractHandle
  getContract <C extends typeof ContractHandle> (
    options: Address|{ address: Address }, $C: C = ContractHandle as C, 
  ): InstanceType<C> {
    return new $C({ instance: options, connection: this }) as InstanceType<C>
  }

  /** Get client handles for all contracts that match a code ID */
  getContractsByCodeId (
    id: Code.CodeId): Promise<Record<Address, ContractHandle>>
  getContractsByCodeId <C extends typeof ContractHandle> (
    id: Code.CodeId, $C: C): Promise<Record<Address, InstanceType<C>>>
  getContractsByCodeId <C extends typeof ContractHandle> (
    id: Code.CodeId, $C: C = ContractHandle as C
  ): Promise<Record<Address, InstanceType<C>>> {
    return this.endpoint.getContractsByCodeId(id).then(contracts=>{
      const results: Record<Address, InstanceType<C>> = {}
      for (const instance of contracts) {
        results[instance.address] = new $C({ instance, connection: this }) as InstanceType<C>
      }
      return results
    })
  }

  /** Get client handles for all contracts that match multiple code IDs */
  getContractsByCodeIds (
    ids: Iterable<Code.CodeId>): Promise<Record<Code.CodeId, Record<Address, ContractHandle>>>
  getContractsByCodeIds <C extends typeof ContractHandle> (
    ids: Iterable<Code.CodeId>, $C?: C): Promise<Record<Code.CodeId, Record<Address, InstanceType<C>>>>
  getContractsByCodeIds <C extends typeof ContractHandle> (
    ids: Record<Code.CodeId, ContractHandle>): Promise<Record<Code.CodeId, Record<Address, InstanceType<C>>>>
  async getContractsByCodeIds (...args: any[]) {
    if (!args[0]) {
      throw new Error('Invalid arguments. Pass Code.CodeId[] or Record<Code.CodeId, typeof ContractHandle>')
    }
    const result: Record<Code.CodeId, Record<Address, ContractHandle>> = {}
    if (args[0][Symbol.iterator]) {
      for (const codeId of args[0]) {
        result[codeId] = await this.getContractsByCodeId(codeId, args[1])
      }
    } else {
      for (const [codeId, $C] of Object.entries(args[0])) {
        result[codeId] = await this.getContractsByCodeId(codeId, args[1])
      }
    }
    return {}
  }

  abstract get height (): Promise<number>

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
          while (this.endpoint.live) {
            await new Promise(ok=>setTimeout(ok, this.blockInterval))
            this.log(
              `Waiting for block > ${bold(String(startingHeight))} ` +
              `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
            )
            const height = await this.height
            console.log({height})
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

  get balance () {
    if (!this.identity?.address) {
      throw new Error('not authenticated, use .getBalance(token, address)')
    } else if (!(this.constructor as { gasToken?: string }).gasToken) {
      throw new Error('no default token for this chain, use .getBalance(token, address)')
    } else {
      return this.getBalance('uknow', this.identity.address)
    }
  }

  abstract getBalance (token: string, address: Address): Promise<string|number|bigint>

  /** Query a contract. */
  async query <Q> (contract: Address|{ address: Address }, message: Message): Promise<Q> {
    const _contract = (typeof contract === 'string') ? { address: contract } : contract
    const result = await this.timed(
      ()=>this.endpoint.query(_contract, message),
      t=>`Queried in ${bold(t)}s: ${bold(_contract)}`
    )
    return result as Q
  }

  /** Send native tokens to 1 recipient. */
  async send (
    recipient: Address|{ address?: Address },
    amounts: Token.ICoin[],
    options?: { sendFee?: Token.IFee, sendMemo?: string }
  ): Promise<unknown> {
    if (typeof recipient === 'object') {
      recipient = recipient.address!
    }
    if (!recipient) {
      throw new Error('no recipient address')
    }
    return await this.timed(
      ()=>this.endpoint.send(recipient as string, amounts, options),
      t=>`Sent in ${bold(t)}s`
    )
  }

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<Code.CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: Store.UploadStore,
      uploadFee?:   Token.ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<Code.UploadedCode & { chainId: ChainId, codeId: Code.CodeId }> {

    let template: Uint8Array
    if (code instanceof Uint8Array) {
      template = code
    } else {
      if (typeof code === 'string' || code instanceof URL) {
        code = new Code.CompiledCode({ codePath: code })
      } else {
        code = new Code.CompiledCode(code)
      }
      const t0 = performance.now()
      template = await (code as Code.CompiledCode).fetch()
      const t1 = performance.now() - t0
      this.log.log(
        `Fetched in`, `${bold((t1/1000).toFixed(6))}s:`,
        bold(String(code.codeData?.length)), `bytes`
      )
    }

    const result = await this.timed(
      () => this.endpoint.upload(template, options),
      (t, result) => [
        `Uploaded in ${bold(t)}: code id ${bold(String(result.codeId))} (${bold(result.codeHash)})`,
      ].join(' ')
    )

    return new Code.UploadedCode({
      ...template, ...result
    }) as Code.UploadedCode & {
      chainId: ChainId, codeId: Code.CodeId,
    }

  }

  /** Instantiate a new program from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   Deploy.ContractInstance with no `address` populated yet.
    *   This will be populated after executing the batch. */
  async instantiate (
    contract: Code.CodeId|Partial<Code.UploadedCode>,
    options:  Partial<Deploy.ContractInstance>
  ): Promise<Deploy.ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new Code.UploadedCode({ codeId: contract })
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
    const { codeId } = contract
    const result = await this.timed(
      async () => this.endpoint.instantiate(codeId, {
        ...options,
        initMsg: await into(options.initMsg)
      }),
      (t, result) => [
        `Instantiated in ${bold(t)} from code id ${bold(String(codeId))}:`,
        bold(String(options.label)), `(${bold(result.address)})`,
      ].join(' ')
    )
    return new Deploy.ContractInstance({
      ...options, ...result
    }) as Deploy.ContractInstance & {
      address: Address
    }
  }

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
    return this.timed(
      () => this.endpoint.execute(contract as { address: Address }, message, options),
      t => `Executed in ${bold(t)}: address ${bold(address)}`
    )
  }

  /** Construct a transaction batch. */
  abstract batch (): Batch<typeof this>
}

export abstract class Endpoint {
  log = new Console(this.constructor.name)

  id?: ChainId
  
  live?: true
  
  mode?: Mode
  
  url?: string
  
  api?: unknown

  constructor (properties: Partial<Endpoint> = {}) {}

  abstract getBlockInfo (): Promise<unknown>

  abstract getBalance (
    token?: string, address?: string
  ): Promise<string|number|bigint>

  abstract getCodeId (
    contract: Address
  ): Promise<Code.CodeId>

  abstract getContractsByCodeId (
    id: Code.CodeId
  ): Promise<Iterable<{ address: Address }>>

  abstract getCodeHashOfAddress (
    contract: Address
  ): Promise<Code.CodeHash>

  abstract getCodeHashOfCodeId (
    codeId: Code.CodeId
  ): Promise<Code.CodeHash>

  abstract query (
    contract: { address: Address }, message: Message
  ): Promise<unknown>

  abstract send (
    recipient: Address, amounts: Token.ICoin[], options?: Parameters<Connection["send"]>[2]
  ): Promise<unknown>

  abstract sendMany (
    outputs: [Address, Token.ICoin[]][], options?: unknown
  ): Promise<unknown>

  abstract upload (
    data: Uint8Array, options: Parameters<Connection["upload"]>[1]
  ): Promise<Partial<Code.UploadedCode>>

  abstract instantiate (
    codeId: Code.CodeId, options: Partial<Deploy.ContractInstance>
  ): Promise<Partial<Deploy.ContractInstance>>

  abstract execute (
    contract: { address: Address }, message: Message, options: Parameters<Connection["execute"]>[2]
  ): Promise<unknown>
}

export abstract class Identity {
  log = new Console(this.constructor.name)

  name?: Address
  address?: Address
  constructor (properties: Partial<Identity> = {}) {}
  abstract sign (): unknown
}

/** ContractHandle: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class ContractHandle {
  log = new Console(this.constructor.name)

  instance: Partial<Deploy.ContractInstance>
  connection?: Connection

  constructor (options: Partial<{
    instance: Address|{ address: Address },
    connection?: Connection
  }> = {}) {
    let { instance, connection } = options
    if (typeof instance === 'string') {
      instance = { address: instance }
    }
    this.instance = instance as Partial<Deploy.ContractInstance>
    this.connection = connection
  }

  /** Execute a query on the specified instance as the specified Connection. */
  query <Q> (message: Message): Promise<Q> {
    if (!this.connection) {
      throw new Error("can't query instance without connection")
    }
    if (!this.instance.address) {
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
    if (!this.instance.address) {
      throw new Error("can't transact with instance without address")
    }
    return this.connection.execute(
      this.instance as Deploy.ContractInstance & { address: Address }, message, options
    )
  }
}

/** Builder object for batched transactions. */
export abstract class Batch<C extends Connection> {
  constructor (readonly connection: C) {}
  /** Add an upload message to the batch. */
  abstract upload (...args: Parameters<C["upload"]>): this
  /** Add an instantiate message to the batch. */
  abstract instantiate (...args: Parameters<C["instantiate"]>): this
  /** Add an execute message to the batch. */
  abstract execute (...args: Parameters<C["execute"]>): this
  /** Submit the batch. */
  abstract submit (...args: unknown[]): Promise<unknown>
}
