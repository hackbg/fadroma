/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Message, Uint128 } from './base'
import { ContractInstance } from './deploy'
import { Error, Logged, bold, into } from './base'
import { assign, Console } from './base'
import * as Deploy from './deploy'
import * as Token from './token'

export type ChainId = string

export class Identity extends Logged {
  name?: Address
  address?: Address
  constructor (properties?: Partial<Identity>) {
    super(properties)
    assign(this, properties, ['name', 'address'])
  }
  sign (doc: any): unknown {
    throw new Error("can't sign: stub")
  }
}

export class Connection extends Logged {
  /** Native token of chain. */
  static gasToken: Token.Native = new Token.Native('')
  /** Native token of chain. */
  static gas (amount: number|Uint128): Token.Amount {
    return this.gasToken.amount(String(amount))
  }
  /** API endpoint. */
  endpoint?: Endpoint
  /** Signer identity. */
  identity?: Identity
  /** Default transaction fees. */
  fees?: { send?: Token.IFee, upload?: Token.IFee, init?: Token.IFee, exec?: Token.IFee }

  constructor (properties: Partial<Connection> = {}) {
    super(properties)
    this.endpoint = properties.endpoint
    this.identity = properties.identity
    this.fees = properties.fees || this.fees
  }

  /** Get the code id of a given address. */
  getCodeId (contract: Address|{ address: Address }): Promise<Deploy.CodeId> {
    const address = (typeof contract === 'string') ? contract : contract.address
    this.log.debug(`Fetching code ID of ${bold(address)}`)
    return timed(
      () => connected(this).getCodeId(address),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}: address ${bold(address)} has code ID ${bold(result)}`
      )
    )
  }

  /** Get the code hash of a given code id. */
  getCodeHashOfCodeId (contract: Deploy.CodeId|{ codeId: Deploy.CodeId }): Promise<Deploy.CodeHash> {
    const codeId = (typeof contract === 'object') ? contract.codeId : contract
    this.log.debug(`Fetching code hash of code id ${bold(codeId)}`)
    return timed(
      () => connected(this).getCodeHashOfCodeId(codeId),
      ({ elapsed, result }) => this.log.debug(
        `Queried in ${bold(elapsed)}: code ID ${bold(codeId)} has hash ${bold(result)}`
      )
    )
  }

  /** Get the code hash of a given address. */
  getCodeHashOfAddress (contract: Address|{ address: Address }): Promise<Deploy.CodeHash> {
    const address = (typeof contract === 'string') ? contract : contract.address
    this.log.debug(`Fetching code hash of address ${bold(address)}`)
    return timed(
      () => connected(this).getCodeHashOfAddress(address),
      ({ elapsed, result }) => this.log.debug(
        `Fetched in ${bold(elapsed)}: code ID ${bold(address)} has hash ${bold(result)}`
      )
    )
  }

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

  /** Get client handles for all contracts that match a code ID */
  getContractsByCodeId (
    id: Deploy.CodeId): Promise<Record<Address, Contract>>
  getContractsByCodeId <C extends typeof Contract> (
    id: Deploy.CodeId, $C: C): Promise<Record<Address, InstanceType<C>>>
  getContractsByCodeId <C extends typeof Contract> (
    id: Deploy.CodeId, $C: C = Contract as C
  ): Promise<Record<Address, InstanceType<C>>> {
    return connected(this).getContractsByCodeId(id).then(contracts=>{
      const results: Record<Address, InstanceType<C>> = {}
      for (const instance of contracts) {
        results[instance.address] = new $C({ instance, connection: this }) as InstanceType<C>
      }
      return results
    })
  }

  /** Get client handles for all contracts that match multiple code IDs */
  getContractsByCodeIds (
    ids: Iterable<Deploy.CodeId>): Promise<Record<Deploy.CodeId, Record<Address, Contract>>>
  getContractsByCodeIds <C extends typeof Contract> (
    ids: Iterable<Deploy.CodeId>, $C?: C): Promise<Record<Deploy.CodeId, Record<Address, InstanceType<C>>>>
  getContractsByCodeIds <C extends typeof Contract> (
    ids: Record<Deploy.CodeId, Contract>): Promise<Record<Deploy.CodeId, Record<Address, InstanceType<C>>>>
  async getContractsByCodeIds (...args: any[]) {
    if (!args[0]) {
      throw new Error('Invalid arguments. Pass Deploy.CodeId[] or Record<Deploy.CodeId, typeof Contract>')
    }
    const result: Record<Deploy.CodeId, Record<Address, Contract>> = {}
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

  get height (): Promise<number> {
    return connected(this).height
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
          while (connected(this).live) {
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

  get balance () {
    if (!this.identity?.address) {
      throw new Error('not authenticated, use .getBalance(token, address)')
    } else if (!(this.constructor as { gasToken?: string }).gasToken) {
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
    token ??= (this.constructor as typeof Connection).gasToken?.id
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
      () => connected(this).getBalance(token, addr),
      ({ elapsed, result }) => this.log.debug(
        `Fetched in ${elapsed}s: balance of ${bold(address)} is ${bold(result)}`
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
      () => connected(this).getBalance(token, addr),
      ({ elapsed, result }) => this.log.debug(
        `Fetched in ${elapsed}s: balance of ${bold(address)} is ${bold(result)}`
      )
    )
  }

  /** Query a contract. */
  async query <Q> (contract: Address|{ address: Address }, message: Message): Promise<Q> {
    const _contract = (typeof contract === 'string') ? { address: contract } : contract
    const result = await timed(
      ()=>connected(this).query(_contract, message),
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
    return await timed(
      ()=>connected(this).send(recipient as string, amounts, options),
      t=>`Sent in ${bold(t)}s`
    )
  }

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<Deploy.CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: Deploy.UploadStore,
      uploadFee?:   Token.ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<Deploy.UploadedCode & { chainId: ChainId, codeId: Deploy.CodeId }> {

    let template: Uint8Array
    if (code instanceof Uint8Array) {
      template = code
    } else {
      if (typeof code === 'string' || code instanceof URL) {
        code = new Deploy.CompiledCode({ codePath: code })
      } else {
        code = new Deploy.CompiledCode(code)
      }
      const t0 = performance.now()
      template = await (code as Deploy.CompiledCode).fetch()
      const t1 = performance.now() - t0
      this.log.log(
        `Fetched in`, `${bold((t1/1000).toFixed(6))}s:`,
        bold(String(code.codeData?.length)), `bytes`
      )
    }

    const result = await timed(
      () => connected(this).upload(template, options),
      ({elapsed, result}) => this.log.debug(
        `Uploaded in ${bold(elapsed)}:\n`,
        ` ${bold(result.codeHash)} = code id ${bold(String(result.codeId))}`,
      ))

    return new Deploy.UploadedCode({
      ...template, ...result
    }) as Deploy.UploadedCode & {
      chainId: ChainId, codeId: Deploy.CodeId,
    }

  }

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
    const { codeId } = contract
    const result = await timed(
      async () => connected(this).instantiate(codeId, {
        ...options,
        initMsg: await into(options.initMsg)
      }),
      ({ elapsed, result }) => this.log.debug(
        `Instantiated in ${bold(elapsed)} from code id ${bold(String(codeId))}:\n`,
        ` ${bold(result.address)} ${options.label}`
      )
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
    return timed(
      () => connected(this).execute(contract as { address: Address }, message, options),
      ({ elapsed }) => this.log.debug(
        `Executed in ${bold(elapsed)}: address ${bold(address)}`
      )
    )
  }

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

function connected ({ endpoint }: { endpoint?: Endpoint }): Endpoint {
  if (!endpoint) {
    throw new Error('not connected')
  }
  return endpoint
}

export abstract class Endpoint extends Logged {
  /** Chain ID. */
  id?: ChainId
  /** Setting this to false stops retries. */
  live: boolean = true
  /** Connection URL. */
  url?: string
  /** Platform SDK. */
  api?: unknown

  constructor (properties: Partial<Endpoint> = {}) {
    super(properties)
  }

  abstract get height (): Promise<number>

  abstract getBlockInfo (): Promise<unknown>

  abstract getBalance (
    token?: string, address?: string
  ): Promise<string|number|bigint>

  abstract getCodeId (
    contract: Address
  ): Promise<Deploy.CodeId>

  abstract getContractsByCodeId (
    id: Deploy.CodeId
  ): Promise<Iterable<{ address: Address }>>

  abstract getCodeHashOfAddress (
    contract: Address
  ): Promise<Deploy.CodeHash>

  abstract getCodeHashOfCodeId (
    codeId: Deploy.CodeId
  ): Promise<Deploy.CodeHash>

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
  ): Promise<Partial<Deploy.UploadedCode>>

  abstract instantiate (
    codeId: Deploy.CodeId, options: Partial<Deploy.ContractInstance>
  ): Promise<Partial<Deploy.ContractInstance>>

  abstract execute (
    contract: { address: Address }, message: Message, options: Parameters<Connection["execute"]>[2]
  ): Promise<unknown>
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

export abstract class Devnet extends Logged {
  /** Which kind of devnet to launch */
  platform?: string
  /** The chain ID that will be passed to the devnet node. */
  chainId?: ChainId
  /** Is this thing on? */
  running: boolean = false
  /** URL for connecting to a remote devnet. */
  url?: string|URL

  constructor (properties?: Partial<Devnet>) {
    super(properties)
    assign(this, properties, ["platform", "chainId", "running", "url"])
  }

  abstract start (): Promise<this>

  abstract pause (): Promise<this>

  abstract export (...args: unknown[]): Promise<unknown>

  abstract import (...args: unknown[]): Promise<unknown>

  abstract getGenesisAccount (name: string): Promise<{ address?: Address, mnemonic?: string }>

  async connect <A extends typeof Connection> (
    ...parameters: [string]|[{name: string}]|[A]|ConstructorParameters<A>
  ): Promise<InstanceType<A>> {
    let agent: InstanceType<A> = undefined!
    return agent
    //if (parameters[0] instanceof Agent) {
      //agent = parameters[0] as InstanceType<A>
    //} else {
      //const params = parameters as ConstructorParameters<A>
      //params[0] ??= {}
      //if (params[0].name) {
        //params[0] = {
          //...await this.getGenesisAccount(params[0].name),
          //...params[0],
        //}
      //}
      //params[0].chainId ??= this.chainId
      //params[0].chainUrl ??= this.url?.toString()
      //agent = new (this.Agent||Agent)(...params)
      //if (params[0]?.chainId && params[0]?.chainId !== this.chainId) {
        //this.log.warn('chainId: ignoring override (devnet)')
      //}
      //if (params[0]?.chainUrl && params[0]?.chainUrl.toString() !== this.url?.toString()) {
        //this.log.warn('chainUrl: ignoring override (devnet)')
      //}
      //if (params[0]?.chainMode && params[0]?.chainMode !== Mode.Devnet) {
        //this.log.warn('chainMode: ignoring override (devnet)')
      //}
    //}
    //return Object.defineProperties(agent, {
      //chainId: {
        //enumerable: true, configurable: true, get: () => this.chainId, set: () => {
          //throw new Error("can't override chain id of devnet")
        //}
      //},
      //chainUrl: {
        //enumerable: true, configurable: true, get: () => this.url?.toString(), set: () => {
          //throw new Error("can't override chainUrl of devnet")
        //}
      //},
      //chainMode: {
        //enumerable: true, configurable: true, get: () => Mode.Devnet, set: () => {
          //throw new Error("agent.chainMode: can't override")
        //}
      //},
      //devnet: {
        //enumerable: true, configurable: true, get: () => this, set: () => {
          //throw new Error("agent.devnet: can't override")
        //}
      //},
      //stopped: {
        //enumerable: true, configurable: true, get: () => !(this.running), set: () => {
          //throw new Error("agent.stopped: can't override")
        //}
      //}
    //})
  }
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
