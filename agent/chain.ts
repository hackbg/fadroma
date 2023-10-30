/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Name, Address, Class, Into, Many, TxHash, Label, Message } from './base'
import { Error, Console, bold, into, assign } from './base'
import type { ICoin, IFee } from './token'
import type { UploadStore } from './store'
import type { CodeHash, CodeId } from './code'
import { CompiledCode, UploadedCode } from './code'
import { ContractInstance, } from './deploy'
import { ContractClient, ContractClientClass } from './client'

/** A chain can be in one of the following modes: */
export enum Mode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** Interface for Devnet (implementation is in @hackbg/fadroma). */
export interface DevnetHandle {
  accounts: string[]
  chainId:  string
  platform: string
  running:  boolean
  stateDir: string
  url:      URL

  containerId?: string
  imageTag?:    string
  port?:        string|number

  start ():
    Promise<this>
  getAccount (name: string):
    Promise<Partial<Agent>>
  assertPresence ():
    Promise<void>
}

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent>
  extends Class<A, ConstructorParameters<typeof Agent>> { Batch: BatchClass<Batch> }

/** A constructor for a Batch subclass. */
export interface BatchClass<B extends Batch>
  extends Class<B, ConstructorParameters<typeof Batch>>{}

/** A connection to a chain. */
export abstract class Agent {

  /** @returns a mainnet instance of this chain. */
  static mainnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Mainnet })
  }

  /** @returns a testnet instance of this chain. */
  static testnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Testnet })
  }

  /** @returns a devnet instance of this chain. */
  static devnet (options: Partial<Agent> = {}): Agent {
    return new (this as any)({ ...options, mode: Mode.Devnet })
  }

  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Agent>): Agent {
    throw new Error('Mocknet is not enabled for this chain.')
  }

  /** The default Batch class used by this Agent. */
  static Batch: BatchClass<Batch> // populated below

  /** Logger. */
  log = new Console(this.constructor.name)

  /** The API URL to use. */
  url:      string = ''

  /** An instance of the underlying implementation-specific SDK. */
  api?:     unknown

  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  mode?:    Mode

  /** The unique id of the chain. */
  chainId?: ChainId

  /** Default fee maximums for send, upload, init, and execute. */
  fees?:    { send?: IFee, upload?: IFee, init?: IFee, exec?: IFee }

  /** If this is a devnet, this contains an interface to the devnet container. */
  devnet?:  DevnetHandle

  /** Whether this chain is stopped. */
  stopped?: boolean

  authenticated: boolean = false

  /** The friendly name of the agent. */
  name?:    string

  /** The address from which transactions are signed and sent. */
  address?: Address

  /** The Batch subclass to use. */
  Batch:    BatchClass<Batch> = (this.constructor as AgentClass<typeof this>).Batch

  constructor (properties?: Partial<Agent>) {
    assign(this, properties, [
      'url', 'mode', 'chainId', 'fees', 'devnet', 'stopped', 'name', 'address', 'api'
    ])
    if (this.devnet) {
      assignDevnet(this, this.devnet)
      if (properties?.chainId && properties?.chainId !== properties?.devnet?.chainId) {
        this.log.warn('chain.id: ignoring override (devnet)')
      }
      if (properties?.url && properties?.url.toString() !== properties?.devnet?.url.toString()) {
        this.log.warn('chain.url: ignoring override (devnet)')
      }
      if (properties?.mode && properties?.mode !== Mode.Devnet) {
        this.log.warn('chain.mode: ignoring override (devnet)')
      }
    } else {
      Object.defineProperties(this, {
        id: {
          enumerable: true, writable: false, value: properties?.chainId
        },
        mode: {
          enumerable: true, writable: false, value: properties?.mode || Mode.Mocknet
        }
      })
      this.url = properties?.url ?? this.url
    }

    if (this.mode === Mode.Mocknet) {
      Object.defineProperty(this, 'url', {
        enumerable: true,
        writable: false,
        value: `fadroma://mocknet-${this.chainId}`
      })
    }

    Object.defineProperties(this, {
      log: {
        configurable: true,
        enumerable: false,
        writable: true,
      },
    })

  }

  /** Compact string tag for console representation. */
  get [Symbol.toStringTag]() {
    return `${this.mode||'(unspecified mode)'} `
         + `${this.chainId||'(unidentified chain)'}: `
         + `${this.name||this.address||'(unauthenticated)'}`
  }

  /** Get a client instance for talking to a specific smart contract as this executor. */
  contract <C extends ContractClient> (
    options?: Address|Partial<ContractInstance>,
    $C: ContractClientClass<C> = ContractClient as ContractClientClass<C>, 
  ): C {
    return new $C(options!, this) as C
  }

  /** Whether this is a mainnet. */
  get isMainnet () {
    return this.mode === Mode.Mainnet
  }

  /** Whether this is a testnet. */
  get isTestnet () {
    return this.mode === Mode.Testnet
  }

  /** Whether this is a devnet. */
  get isDevnet  () {
    return this.mode === Mode.Devnet
  }

  /** Whether this is a mocknet. */
  get isMocknet () {
    return this.mode === Mode.Mocknet
  }

  /** Whether this is a devnet or mocknet. */
  get devMode () {
    return this.isDevnet || this.isMocknet
  }

  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    return this.height.then(async startingHeight=>{
      startingHeight = Number(startingHeight)
      if (isNaN(startingHeight)) {
        this.log.warn('Current block height undetermined. not waiting for next block')
        return Promise.resolve(NaN)
      }
      this.log.waitingForBlock(startingHeight)
      const t = + new Date()
      return new Promise(async (resolve, reject)=>{
        try {
          while (true && !this.stopped) {
            await new Promise(ok=>setTimeout(ok, 250))
            this.log.waitingForBlock(startingHeight, + new Date() - t)
            const height = await this.height
            if (height > startingHeight) {
              this.log.info(`Block height incremented to ${bold(String(height))}, continuing`)
              return resolve(height)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  async query (contract: Address|{ address: Address }, message: Message): Promise<unknown> {
    if (typeof contract === 'string') contract = { address: contract }
    const t0 = performance.now()
    const result = this.doQuery(contract, message)
    const t1 = performance.now() - t0
    this.log.debug(
      `Queried in`,
      bold(t1.toFixed(3)),
      `msec: address`,
      bold(contract.address)
    )
    return result
  }

  /** Create a new, authenticated Agent. */
  async authenticate (options?: {
    name?:     Name,
    address?:  Address,
    mnemonic?: string
  }): Promise<this> {
    if (!options?.mnemonic && options?.name && this.devnet) {
      await this.devnet.start()
      const account = await this.devnet.getAccount(options.name)
      options = { ...options, ...account }
    }
    return new (this.constructor as any)({
      ...this,
      ...options
    })
  }

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: UploadStore,
      uploadFee?:   ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<UploadedCode & { chainId: ChainId, codeId: CodeId }> {
    let template: Uint8Array
    if (code instanceof Uint8Array) {
      template = code
    } else {
      if (typeof code === 'string' || code instanceof URL) {
        code = new CompiledCode({ codePath: code })
      } else {
        code = new CompiledCode(code)
      }
      const t0 = performance.now()
      template = await (code as CompiledCode).fetch()
      const t1 = performance.now() - t0
      this.log.log(
        `Fetched in`,
        bold(t1.toFixed(3)),
        `msec:`,
        bold(String(code.codeData?.length)),
        `bytes`
      )
    }
    const t0 = performance.now()
    const result = await this.doUpload(template, options)
    const t1 = performance.now() - t0
    this.log.log(
      `Uploaded in`,
      bold(t1.toFixed(3)),
      `msec: code id`,
      bold(String(result.codeId)),
      `on chain`,
      bold(result.chainId)
    )
    return new UploadedCode({
      ...template, ...result
    }) as UploadedCode & {
      chainId: ChainId, codeId: CodeId,
    }
  }

  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   ContractInstance with no `address` populated yet.
    *   This will be populated after executing the batch. */
  async instantiate (
    contract: CodeId|Partial<UploadedCode>,
    options:  Partial<ContractInstance>
  ): Promise<ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new UploadedCode({ codeId: contract })
    }
    if (isNaN(Number(contract.codeId))) {
      throw new Error(`invalid code id: ${contract.codeId}`)
    }
    if (!contract.codeId) {
      throw new Error.Missing.CodeId()
    }
    if (!options.label) {
      throw new Error.Missing.Label()
    }
    if (!options.initMsg) {
      throw new Error.Missing.InitMsg()
    }
    const t0 = performance.now()
    const result = await this.doInstantiate(contract.codeId, {
      ...options,
      initMsg: await into(options.initMsg)
    })
    const t1 = performance.now() - t0
    this.log.debug(
      `Instantiated in`,
      bold(t1.toFixed(3)),
      `msec: code id`,
      bold(String(contract.codeId)),
      `address`,
      bold(result.address)
    )
    return new ContractInstance({
      ...options, ...result
    }) as ContractInstance & {
      address: Address
    }
  }

  /** Call a transaction method on a smart contract. */
  async execute (
    contract: Address|Partial<ContractInstance>,
    message:  Message,
    options?: { execFee?: IFee, execSend?: ICoin[], execMemo?: string }
  ): Promise<unknown> {
    if (typeof contract === 'string') contract = new ContractInstance({ address: contract })
    if (!contract.address) throw new Error("agent.execute: no contract address")
    const t0 = performance.now()
    const result = await this.doExecute(contract as { address: Address }, message, options)
    const t1 = performance.now() - t0
    this.log.debug(
      `Executed in`,
      bold(t1.toFixed(3)),
      `msec: address`,
      bold(contract.address)
    )
    return result
  }

  /** Execute a transaction batch.
    * @returns Batch if called with no arguments
    * @returns Promise<any[]> if called with Batch#wrap args */
  batch <B extends Batch> (cb?: BatchCallback<B>): B {
    return new this.Batch(this, cb as BatchCallback<Batch>) as unknown as B
  }

  /** The default denomination of the chain's native token. */
  abstract defaultDenom:
    string

  abstract getBlockInfo ():
    Promise<unknown>

  abstract get height ():
    Promise<number>

  abstract getContractCodeId (contract: Address):
    Promise<CodeId>

  abstract getContractCodeHash (contract: Address):
    Promise<CodeHash>

  abstract getCodeHash (codeId: CodeId):
    Promise<CodeHash>

  abstract doQuery (contract: { address: Address }, message: Message):
    Promise<unknown>

  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: unknown):
    Promise<unknown>

  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: unknown):
    Promise<unknown>

  protected abstract doUpload (
    data: Uint8Array, options: Parameters<typeof this["upload"]>[1]
  ): Promise<Partial<UploadedCode>>

  protected abstract doInstantiate (
    codeId: CodeId, options: Partial<ContractInstance>
  ): Promise<Partial<ContractInstance>>

  protected abstract doExecute (
    contract: { address: Address }, message: Message, options: Parameters<this["execute"]>[2]
  ): Promise<unknown>

}

/** Function passed to Batch#wrap */
export type BatchCallback<B extends Batch> = (batch: B)=>Promise<void>

/** Batch is an alternate executor that collects messages to broadcast
  * as a single transaction in order to execute them simultaneously.
  * For that, it uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.batch().wrap(async batch=>{ client.as(batch).exec(...) }) */
export abstract class Batch implements Agent {
  /** Messages in this batch, unencrypted. */
  msgs: any[] = []
  /** Next message id. */
  id = 0
  /** Nested batches are flattened, this counts the depth. */
  depth = 0

  constructor (
    /** The agent that will execute the batched transaction. */
    public agent: Agent,
    /** Evaluating this defines the contents of the batch. */
    public callback?: (batch: Batch)=>unknown
  ) {
    super()
    if (!agent) throw new Error.Missing.Agent('for batch')
  }

  get [Symbol.toStringTag]() { return `(${this.msgs.length}) ${this.address}` }

  log = new Console(this.constructor.name)

  get ready () { return this.agent.ready.then(()=>this) }

  get chain () { return this.agent.chain }

  get address () { return this.agent.address }

  get name () { return `${this.agent.name} (batched)` }

  get fees () { return this.agent.fees }

  get defaultDenom () { return this.agent.defaultDenom }

  getClient <C extends ContractClient> (...args: Parameters<Agent["getClient"]>): C {
    return this.agent.getClient(...args) as C
  }

  /** Add a message to the batch. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  /** Either submit or save the batch. */
  async run (options: Partial<{
    memo: string,
    save: boolean
  }> = {}): Promise<unknown> {
    if (this.depth > 0) {
      this.log.warn('Unnesting batch. Depth:', --this.depth)
      this.depth--
      return null as any // result ignored
    } else if (options.save) {
      this.log('Saving batch')
      return this.save(options.memo)
    } else {
      this.log('Submitting batch')
      return this.submit(options.memo)
    }
  }

  /** Broadcast a batch to the chain. */
  async submit (memo?: string): Promise<unknown> {
    this.log.warn('Batch#submit: this function is stub; use a subclass of Batch')
    if (memo) this.log.info('Memo:', memo)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Save a batch for manual broadcast. */
  async save (name?: string): Promise<unknown> {
    this.log.warn('Batch#save: this function is stub; use a subclass of Batch')
    if (name) this.log.info('Name:', name)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Throws if the batch is invalid. */
  assertMessages (): any[] {
    if (this.msgs.length < 1) {
      this.log.emptyBatch()
      throw new Error('Batch contained no messages.')
    }
    return this.msgs
  }

  /** Add an init message to the batch. */
  async instantiate (
    contract: CodeId|Partial<UploadedCode>,
    options: {
      label:     Name,
      initMsg:   Into<Message>,
      initFee?:  unknown,
      initSend?: ICoin[],
      initMemo?: string,
    }
  ): Promise<ContractInstance & {
    address: Address,
  }> {
    if (typeof contract === 'string') {
      contract = new UploadedCode({ codeId: contract })
    }
    this.add({ init: {
      codeId:   contract.codeId,
      codeHash: contract.codeHash,
      label:    options.label,
      msg:      await into(options.initMsg),
      sender:   this.address,
      funds:    options.initSend || [],
      memo:     options.initMemo  || ''
    } })
    return new ContractInstance({
      chainId:  this.agent.chain!.id,
      address:  '(batch not submitted)',
      codeHash: contract.codeHash,
      label:    options.label,
      initBy:   this.address,
    }) as ContractInstance & { address: Address }
  }

  /** Add an exec message to the batch. */
  async execute (
    contract: Address|{ address: Address, codeHash?: CodeHash },
    message:  Message,
    options:  Parameters<Agent["execute"]>[2] = {}
  ): Promise<this> {
    let address: Address
    let codeHash: CodeHash|undefined = undefined
    if (typeof contract === 'string') {
      address = contract
    } else {
      address = contract.address
      codeHash = contract.codeHash
    }
    this.add({
      exec: {
        sender:   this.address,
        contract: address,
        codeHash,
        msg:      message,
        funds:    options.execSend
      }
    })
    return this
  }

  /** Queries are disallowed in the middle of a batch because
    * even though the batch API is structured as multiple function calls,
    * the batch is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (
    contract: Address|{ address: Address, codeHash?: CodeHash },
    msg: Message
  ): Promise<never> {
    throw new Error('operation not allowed in batch: query')
  }

  /** Uploads are disallowed in the middle of a batch because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (data: unknown): Promise<never> {
    throw new Error("operation not allowed in batch: upload")
  }
  async doUpload (data: unknown): Promise<never> {
    throw new Error("operation not allowed in batch: upload")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get balance (): Promise<string> {
    throw new Error("operation not allowed in batch: query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new Error("operation not allowed in batch: query block height inside batch")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new Error("operation not allowed in batch: wait for next block")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new Error("operation not allowed in batch: query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async send (
    recipient: Address, amounts: ICoin[], options?: Parameters<Agent["send"]>[2]
  ): Promise<void|unknown> {
    throw new Error("operation not allowed in batch: send")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async sendMany (
    outputs: [Address, ICoin[]][], options?: Parameters<Agent["sendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error("operation not allowed in batch: send")
  }
  /** Nested batches are "flattened": trying to create a batch
    * from inside a batch returns the same batch. */
  batch <B extends Batch> (cb?: BatchCallback<B>): B {
    if (cb) this.log.warn('Nested batch callback ignored.')
    this.log.warn('Nest batches with care. Depth:', ++this.depth)
    return this as unknown as B
  }
  /** Batch class to use when creating a batch inside a batch.
    * @default self */
  Batch = this.constructor as { new (agent: Agent): Batch }
}

function assignDevnet (agent: Agent, devnet: DevnetHandle) {
  Object.defineProperties(agent, {
    id: {
      enumerable: true, configurable: true,
      get: () => devnet.chainId, set: () => {
        throw new Error("can't override chain id of devnet")
      }
    },
    url: {
      enumerable: true, configurable: true,
      get: () => devnet.url.toString(), set: () => {
        throw new Error("can't override url of devnet")
      }
    },
    'mode': {
      enumerable: true, configurable: true,
      get: () => Mode.Devnet, set: () => {
        throw new Error("chain.mode: can't override")
      }
    },
    'devnet': {
      enumerable: true, configurable: true,
      get: () => devnet, set: () => {
        throw new Error("chain.devnet: can't override")
      }
    },
    'stopped': {
      enumerable: true, configurable: true,
      get: () => !(devnet.running), set: () => {
        throw new Error("chain.stopped: can't override")
      }
    }
  })
}
