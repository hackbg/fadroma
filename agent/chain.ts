/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Name, Address, Class, Into, Many, TxHash, Label, Message } from './base'
import { Error, Console, bold, into } from './base'
import type { ICoin, IFee } from './token'
import type { Batch, BatchClass, BatchCallback } from './batch'
import type { UploadStore } from './store'
import type { CodeHash, CodeId } from './code'
import { CompiledCode, UploadedCode } from './code'
import { ContractInstance, } from './deploy'
import { ContractClient, ContractClientClass } from './client'

/** A chain can be in one of the following modes: */
export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Chain>

/** Interface for Devnet (implementation is in @hackbg/fadroma). */
export interface DevnetHandle {
  accounts:     string[]
  chainId:      string
  platform:     string
  running:      boolean
  stateDir:     string
  url:          URL

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

/** A constructor for a Chain subclass. */
export interface ChainClass<C> extends Class<C, ConstructorParameters<typeof Chain>> {
  Agent: AgentClass<Agent> // static
}

/** Represents a particular chain, identified by chain ID and connected by URL.
  * The chain can be in one of several modes (mainnet or other), can optionally
  * hold a reference to the managed devnet container, can query state, and can
  * construct authorized agents. */
export abstract class Chain {

  constructor ({ id, url, mode, devnet }: Partial<Chain> = {}) {

    if (devnet) {
      Object.defineProperties(this, {
        id: {
          enumerable: true,
          configurable: true,
          get: () => devnet.chainId,
          set: () => { throw new Error("can't override chain id of devnet") }
        },
        url: {
          enumerable: true,
          configurable: true,
          get: () => devnet.url.toString(),
          set: () => { throw new Error("can't override url of devnet") }
        },
        'mode': {
          enumerable: true,
          configurable: true,
          get: () => Chain.Mode.Devnet,
          set: () => { throw new Error("chain.mode: can't override") }
        },
        'devnet': {
          enumerable: true,
          configurable: true,
          get: () => devnet,
          set: () => { throw new Error("chain.devnet: can't override") }
        },
        'stopped': {
          enumerable: true,
          configurable: true,
          get: () => !this.devnet!.running,
          set: () => { throw new Error("chain.stopped: can't override") }
        }
      })
      if (id && id !== devnet.chainId) {
        this.log.warn('chain.id: ignoring override (devnet)')
      }
      if (url && url.toString() !== devnet.url.toString()) {
        this.log.warn('chain.url: ignoring override (devnet)')
      }
      if (mode && mode !== Chain.Mode.Devnet) {
        this.log.warn('chain.mode: ignoring override (devnet)')
      }
    } else {
      if (id) {
        Object.defineProperty(this, 'id', {
          enumerable: true,
          writable:   false,
          value:      id
        })
      }
      if (mode) {
        Object.defineProperty(this, 'mode', {
          enumerable: true,
          writable:   false,
          value:      mode
        })
      }
      this.url = url ?? this.url
    }

    Object.defineProperty(this, 'log', {
      enumerable: false,
      writable: true,
    })

    Object.defineProperty(this, 'Agent', {
      enumerable: false,
      writable: true
    })

  }

  /** Logger. */
  log = new Console(this.constructor.name)

  /** The API URL to use. */
  url: string = ''

  /** If this is a devnet, this contains an interface to the devnet container. */
  devnet?: DevnetHandle

  /** Whether this chain is stopped. */
  stopped: boolean = false

  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentClass<Agent> = (this.constructor as ChainClass<unknown>).Agent

  /** Compact string tag for console representation. */
  get [Symbol.toStringTag]() { return `${this.mode}: ${this.id} @ ${this.url}` }

  /** The unique chain id. */
  get id (): ChainId { throw new Error("chain.id: not set") }
  set id (id: string) { throw new Error("chain.id: can't override") } 

  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  get mode (): ChainMode { throw new Error('chain.mode: not set') }

  /** Whether this is a mainnet. */
  get isMainnet () { return this.mode === ChainMode.Mainnet }

  /** Whether this is a testnet. */
  get isTestnet () { return this.mode === ChainMode.Testnet }

  /** Whether this is a devnet. */
  get isDevnet  () { return this.mode === ChainMode.Devnet }

  /** Whether this is a mocknet. */
  get isMocknet () { return this.mode === ChainMode.Mocknet }

  /** Whether this is a devnet or mocknet. */
  get devMode () { return this.isDevnet || this.isMocknet }

  /** Return self. */
  get chain () { return this }

  api?: unknown

  abstract getApi (): unknown

  get ready () {
    if (this.isDevnet && !this.devnet) {
      throw new Error("the chain is marked as a devnet but is missing the devnet handle")
    }
    type This = this
    type ThisWithApi = This & { api: NonNullable<This["api"]> }
    const init = new Promise<ThisWithApi>(async (resolve, reject)=>{
      if (this.isDevnet) {
        await this.devnet!.start()
      }
      if (!this.api) {
        if (!this.url) throw new Error("the chain's url property is not set")
        this.api = await Promise.resolve(this.getApi())
      }
      return resolve(this as ThisWithApi)
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
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
          while (true && !this.chain.stopped) {
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

  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string

  /** Get the current block height. */
  abstract get height (): Promise<number>

  /** Get the native balance of an address. */
  abstract getBalance (denom: string, address: Address): Promise<string>

  /** Query a smart contract. */
  abstract query <Q> (contract: Address|{ address: Address, codeHash?: CodeHash }, msg: Message):
    Promise<Q>

  /** Get the code id of a smart contract. */
  abstract getCodeId (address: Address): Promise<CodeId>

  /** Get the code hash of a smart contract. */
  abstract getHash (address: Address|number): Promise<CodeHash>

  /** Get the label of a smart contract. */
  abstract getLabel (address: Address): Promise<string>

  /** Get a new instance of the appropriate Agent subclass. */
  getAgent (options?: Partial<Agent>): Agent
  getAgent ($A: AgentClass<Agent>, options?: Partial<Agent>): InstanceType<typeof $A>
  getAgent (...args: any) {
    const $A = (typeof args[0] === 'function') ? args[0] : this.Agent
    let options = (typeof args[0] === 'function') ? args[1] : args[0]
    options = { ...options||{}, chain: this }
    const agent = new $A(options)
    return agent
  }

  /** The default Agent subclass to use for interacting with this chain. */
  static Agent: AgentClass<Agent> // populated below

  /** Shorthand for the ChainMode enum. */
  static Mode = ChainMode

  /** @returns a mainnet instance of this chain. */
  static mainnet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Mainnet })
  }

  /** @returns a testnet instance of this chain. */
  static testnet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Testnet })
  }

  /** @returns a devnet instance of this chain. */
  static devnet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Devnet })
  }

  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Chain>): Chain {
    throw new Error('Mocknet is not enabled for this chain.')
  }

}

/** @returns the chain of a thing
  * @throws if missing. */
export function assertChain <C extends Chain> (thing: { chain?: C|null } = {}): C {
  if (!thing.chain) throw new Error.Missing.Chain()
  return thing.chain
}

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Batch: BatchClass<Batch> // static
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  /** Logger. */
  log = new Console(this.constructor.name)
  /** The friendly name of the agent. */
  name?:     string
  /** The chain on which this agent operates. */
  chain?:    Chain
  /** The address from which transactions are signed and sent. */
  address?:  Address
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:     AgentFees
  /** The Batch subclass to use. */
  Batch:     BatchClass<Batch> = (this.constructor as AgentClass<typeof this>).Batch
  /** The default Batch class used by this Agent. */
  static Batch: BatchClass<Batch> // populated below

  constructor (options: Partial<Agent> = {}) {
    this.chain = options.chain ?? this.chain
    this.name = options.name ?? this.name
    this.fees = options.fees ?? this.fees
    this.address = options.address ?? this.address
    Object.defineProperties(this, {
      chain:   { enumerable: false, writable: true, configurable: true },
      address: { enumerable: false, writable: true, configurable: true },
      log:     { enumerable: false, writable: true, configurable: true },
      Batch:   { enumerable: false, writable: true, configurable: true },
    })
  }

  get [Symbol.toStringTag]() {
    return `${this.address} @ ${this.chain?.id}`
  }

  /** Complete the asynchronous initialization of this Agent. */
  get ready (): Promise<this> {
    const init = new Promise<this>(async (resolve, reject)=>{
      try {
        if (this.chain?.devnet) await this.chain?.devnet.start()
        if (!this.mnemonic && this.name && this.chain?.devnet) {
          Object.assign(this, await this.chain?.devnet.getAccount(this.name))
        }
        resolve(this)
      } catch (e) {
        reject(e)
      }
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

  /** The default denomination in which the agent operates. */
  get defaultDenom () {
    return assertChain(this).defaultDenom
  }

  /** This agent's balance in the chain's native token. */
  get balance (): Promise<string> {
    return this.getBalance()
  }

  /** The chain's current block height. */
  get height (): Promise<number> {
    return assertChain(this).height
  }

  /** Wait until the block height increments. */
  get nextBlock () {
    return assertChain(this).nextBlock
  }

  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    assertChain(this)
    if (!address) throw new Error.Missing.Address()
    return this.chain!.getBalance(denom!, address)
  }

  /** Get the code ID of a contract. */
  getCodeId (address: Address) {
    return assertChain(this).getCodeId(address)
  }

  /** Get the label of a contract. */
  getLabel (address: Address) {
    return assertChain(this).getLabel(address)
  }

  /** Get the code hash of a contract or template. */
  getHash (address: Address|number) {
    return assertChain(this).getHash(address)
  }

  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: unknown): Promise<void|unknown>

  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: unknown): Promise<void|unknown>

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (
    code: string|URL|Uint8Array|Partial<CompiledCode>,
    options: {
      reupload?:    boolean,
      uploadStore?: UploadStore,
      uploadFee?:   ICoin[]|'auto',
      uploadMemo?:  string
    } = {},
  ): Promise<UploadedCode & {
    chainId: ChainId,
    codeId:  CodeId,
  }> {
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
    return new UploadedCode({ ...template, ...result }) as UploadedCode & {
      chainId: ChainId,
      codeId:  CodeId,
    }
  }

  protected abstract doUpload (
    data: Uint8Array,
    options: Parameters<typeof this["upload"]>[1]
  ): Promise<Partial<UploadedCode>>

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
      ...options,
      ...result
    }) as ContractInstance & {
      address: Address
    }
  }

  protected abstract doInstantiate (
    codeId:  CodeId,
    options: Partial<ContractInstance>
  ): Promise<Partial<ContractInstance>>

  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends ContractClient> (
    options?: Address|Partial<ContractInstance>,
    $C: ContractClientClass<C> = ContractClient as ContractClientClass<C>, 
  ): C {
    return new $C(options!, this) as C
  }

  /** Call a transaction method on a smart contract. */
  async execute (
    contract: Address|Partial<ContractInstance>,
    message:  Message,
    options?: {
      execFee?:  IFee
      execSend?: ICoin[]
      execMemo?: string
    }
  ): Promise<unknown> {
    if (typeof contract === 'string') contract = new ContractInstance({ address: contract })
    if (!contract.address) throw new Error("agent.execute: no contract address")
    const t0 = performance.now()
    const result = await this.doExecute(contract as { address: Address }, message, options)
    const t1 = performance.now() - t0
    return result
  }

  protected abstract doExecute (
    contract: { address: Address },
    message:  Message,
    options:  Parameters<this["execute"]>[2]
  ): Promise<unknown>

  /** Query a contract on the chain. */
  query <Q> (
    contract: Address|{ address: Address, codeHash?: CodeHash },
    message: Message
  ): Promise<Q> {
    return assertChain(this).query(contract, message)
  }

  /** Execute a transaction batch.
    * @returns Batch if called with no arguments
    * @returns Promise<any[]> if called with Batch#wrap args */
  batch <B extends Batch> (cb?: BatchCallback<B>): B {
    return new this.Batch(this, cb as BatchCallback<Batch>) as unknown as B
  }
}

/** Default fees for the main operations that an Agent can perform. */
export interface AgentFees {
  send?:   IFee
  upload?: IFee
  init?:   IFee
  exec?:   IFee
}
