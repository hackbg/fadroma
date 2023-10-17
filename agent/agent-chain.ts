/**

  Fadroma: Base Agent/Chain API
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import type {
  Class, Address, Message, ExecOpts, AgentFees, ICoin, IFee, CodeHash, Client, ClientClass,
  Uploaded, Instantiated, AnyContract, Contract, Uploader, UploaderClass, Name, Many, CodeId,
  Uploadable
} from './agent'
import { Error, Console, into, prop, hideProperties as hide, randomBytes } from './agent-base'

/** A chain can be in one of the following modes: */
export enum ChainMode {
  Mainnet = 'Mainnet', Testnet = 'Testnet', Devnet = 'Devnet', Mocknet = 'Mocknet'
}
/** The unique ID of a chain. */
export type ChainId = string
/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Chain>
/** Options for connecting to a chain. */
export interface DevnetHandle {
  url: URL
  running: boolean
  chainId: string
  platform: string
  start: () => Promise<this>
  getAccount: (name: string) => Promise<Partial<Agent>>
  assertPresence: () => Promise<void>
}
/** A constructor for a Chain subclass. */
export interface ChainClass<C> extends Class<C, ConstructorParameters<typeof Chain>> {
  Agent: AgentClass<Agent> // static
}
/** Represents a particular chain. */
export abstract class Chain {
  /** Logger. */
  log = new Console('@fadroma/agent: Chain')
  /** The unique chain id. */
  id: ChainId
  /** The API URL to use. */
  url: string = ''
  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  mode: ChainMode
  /** If this is a devnet, this contains an interface to the devnet container. */
  devnet?: DevnetHandle
  /** Whether this chain is stopped. */
  stopped: boolean = false
  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentClass<Agent> = (this.constructor as ChainClass<unknown>).Agent
  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string

  constructor (options: Partial<Chain> = {}) {
    if (!(this.id = options.id!)) throw new Error.Missing.ChainId()
    this.log.label = this.id ?? `(no chain id)`
    this.url  = options.url ?? this.url
    this.mode = options.mode!
    if (options.devnet) {
      if (options.mode === Chain.Mode.Devnet) {
        this.devnet = options.devnet
        if (this.url !== String(this.devnet.url)) {
          if (!!this.url) this.log.devnetUrlOverride(this.devnet.url, this.url)
          this.url = String(this.devnet.url)
        }
        if (this.id !== this.devnet.chainId) {
          if (!!this.url) this.log.devnetIdOverride(this.devnet.chainId, this.id)
          this.id = this.devnet.chainId
        }
      } else {
        this.log.devnetModeInvalid()
      }
    }
    this.log.label = this.id ?? `(no chain id)` // again
    if (this.devnet) {
      this.log.label = `${this.log.label} @ ${this.devnet.url}`
      Object.defineProperty(this, 'stopped', { get () { return !this.devnet.running } })
    }
    Object.defineProperties(this, {
      'id':    { enumerable: false, writable: true },
      'url':   { enumerable: false, writable: true },
      'mode':  { enumerable: false, writable: true },
      'log':   { enumerable: false, writable: true },
      'Agent': { enumerable: false, writable: true },
    })
  }

  get [Symbol.toStringTag]() { return `${this.mode}: ${this.id} @ ${this.url}` }

  /** Whether this is a mainnet. */
  get isMainnet () { return this.mode === ChainMode.Mainnet }
  /** Whether this is a testnet. */
  get isTestnet () { return this.mode === ChainMode.Testnet }
  /** Whether this is a devnet. */
  get isDevnet  () { return this.mode === ChainMode.Devnet }
  /** Whether this is a mocknet. */
  get isMocknet () { return this.mode === ChainMode.Mocknet }
  /** Whether this is a devnet or mocknet. */
  get devMode   () { return this.isDevnet || this.isMocknet }
  /** Return self. */
  get chain     () { return this }
  /** Get the current block height. */
  get height    (): Promise<number> { return Promise.resolve(0) }
  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    return this.height.then(async startingHeight=>{
      startingHeight = Number(startingHeight)
      if (isNaN(startingHeight)) {
        this.log.warn('current block height undetermined. not waiting for next block')
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
              this.log.info(`block height incremented to ${height}, continuing`)
              return resolve(height)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /** Get the native balance of an address. */
  abstract getBalance (denom: string, address: Address): Promise<string>
  /** Query a smart contract. */
  abstract query <U> (contract: Client, msg: Message): Promise<U>
  /** Get the code id of a smart contract. */
  abstract getCodeId (address: Address): Promise<CodeId>
  /** Get the code hash of a smart contract. */
  abstract getHash (address: Address|number): Promise<CodeHash>
  /** Get the label of a smart contract. */
  abstract getLabel (address: Address): Promise<string>

  /** Get the code hash of a smart contract. */
  async checkHash (address: Address, expectedCodeHash?: CodeHash) {
    // Soft code hash checking for now
    const fetchedCodeHash = await this.getHash(address)
    if (!expectedCodeHash) {
      this.log.noCodeHash(address)
    } if (expectedCodeHash !== fetchedCodeHash) {
      this.log.codeHashMismatch(address, expectedCodeHash, fetchedCodeHash)
    } else {
      this.log.confirmCodeHash(address, fetchedCodeHash)
    }
    return fetchedCodeHash
  }

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
    options = { ...options, mode: Chain.Mode.Devnet }
    if (options.devnet) {
      options.id = options.devnet.chainId
      options.url = options.devnet.url.toString()
    }
    return new (this as any)(options)
  }
  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Chain>): Chain {
    throw new Error('Mocknet is not enabled for this chain.')
  }
}

export class StubChain extends Chain {

  defaultDenom = 'stub'

  /** Stub implementation of getting native balance. */
  getBalance (denom: string, address: Address): Promise<string> {
    this.log.warn('chain.getBalance: this function is stub; use a subclass of Agent')
    return Promise.resolve('0')
  }

  /** Stub implementation of querying a smart contract. */
  query <U> (contract: Client, msg: Message): Promise<U> {
    this.log.warn('chain.query: this function is stub; use a subclass of Agent')
    return Promise.resolve({} as U)
  }

  /** Stub implementation of getting a code id. */
  getCodeId (address: Address): Promise<CodeId> {
    this.log.warn('chain.getCodeId: this function is stub; use a subclass of Agent')
    return Promise.resolve('code-id-stub')
  }

  /** Stub implementation of getting a code hash. */
  getHash (address: Address|number): Promise<CodeHash> {
    this.log.warn('chain.getHash: this function is stub; use a subclass of Agent')
    return Promise.resolve('code-hash-stub')
  }

  /** Stub implementation of getting a contract label. */
  getLabel (address: Address): Promise<string> {
    this.log.warn('chain.getLabel: this function is stub; use a subclass of Agent')
    return Promise.resolve('contract-label-stub')
  }

}

/** @returns the chain of a thing
  * @throws  ExpectedChain if missing. */
export function assertChain <C extends Chain> (thing: { chain?: C|null } = {}): C {
  if (!thing.chain) throw new Error.Missing.Chain()
  return thing.chain
}
/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Bundle: BundleClass<Bundle> // static
}
/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  log = new Console('@fadroma/agent: Agent')
  /** The friendly name of the agent. */
  name?:     string
  /** The chain on which this agent operates. */
  chain?:    Chain
  /** The address from which transactions are signed and sent. */
  address?:  Address
  /** The wallet's mnemonic. */
  mnemonic?: string
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:     AgentFees
  /** The Bundle subclass to use. */
  Bundle:    BundleClass<Bundle> = (this.constructor as AgentClass<typeof this>).Bundle
  /** The default Bundle class used by this Agent. */
  static Bundle: BundleClass<Bundle> // populated below

  constructor (options: Partial<Agent> = {}) {
    this.chain   = options.chain ?? this.chain
    this.name    = options.name  ?? this.name
    this.fees    = options.fees  ?? this.fees
    this.address = options.address  ?? this.address
    hide(this, 'chain', 'address', 'log', 'Bundle')
    prop(this, 'mnemonic', options.mnemonic)
  }

  get [Symbol.toStringTag]() {
    return `${this.address} @ ${this.chain?.id}${this.mnemonic ? ' (*)' : ''}`
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
  /** Check the code hash of a contract at an address against an expected value. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return assertChain(this).checkHash(address, codeHash)
  }
  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  abstract upload (data: Uint8Array, meta?: Partial<Uploadable>): Promise<Uploaded>
  /** Get an uploader instance which performs code uploads and optionally caches them. */
  getUploader <U extends Uploader> ($U: UploaderClass<U>, options?: Partial<U>): U {
    return new $U({ agent: this, ...options||{} }) as U
  }
  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   AnyContract with no `address` populated yet.
    *   This will be populated after executing the bundle. */
  abstract instantiate <C extends Client> (instance: Contract<C>): PromiseLike<Instantiated>
  /** Create multiple smart contracts from a Template (providing code id)
    * and a list or map of label/initmsg pairs.
    * Uses this agent's Bundle class to instantiate them in a single transaction.
    * @example
    *   await agent.instantiateMany(template.instances({
    *     One: { label, initMsg },
    *     Two: { label, initMsg },
    *   }))
    *   await agent.instantiateMany({
    *     One: template1.instance({ label, initMsg }),
    *     Two: template2.instance({ label, initMsg }),
    *   }))
    * @returns
    *   either an Array<AnyContract> or a Record<string, AnyContract>,
    *   depending on what is passed as inputs. */
  async instantiateMany <C extends Many<AnyContract>> (instances: C): Promise<C> {
    // Returns an array of TX results.
    const bundle = this.bundle((bundle: any)=>bundle.instantiateMany(instances))
    const response = await bundle.run()
    // Populate instances with resulting addresses
    for (const instance of Object.values(instances)) {
      if (instance.address) continue
      // Find result corresponding to instance
      const found = response.find(({ label }:any)=>label===instance.label)
      if (found) {
        const { address, tx, sender } = found // FIXME: implementation dependent
        instance.define({ address, initTx: tx, initBy: sender } as any)
      } else {
        this.log.warn(`Failed to find address for ${instance.label}.`)
        continue
      }
    }
    return instances
  }
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client> (
    $C: ClientClass<C>, address?: Address, codeHash?: CodeHash, ...args: unknown[]
  ): C {
    return new $C({ agent: this,  address, codeHash } as any) as C
  }
  /** Call a transaction method on a smart contract. */
  abstract execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown>
  /** Query a contract on the chain. */
  query <R> (contract: Client, msg: Message): Promise<R> {
    return assertChain(this).query(contract, msg)
  }
  /** Execute a transaction bundle.
    * @returns Bundle if called with no arguments
    * @returns Promise<any[]> if called with Bundle#wrap args */
  bundle <B extends Bundle> (cb?: BundleCallback<B>): B {
    return new this.Bundle(this, cb as BundleCallback<Bundle>) as unknown as B
  }
}

export class StubAgent extends Agent {
  /** Stub implementation of sending native token. */
  send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#send: this function is stub; use a subclass of Agent')
    return Promise.resolve()
  }
  /** Stub implementation of batch send. */
  sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#sendMany: this function is stub; use a subclass of Agent')
    return Promise.resolve()
  }
  /** Stub implementation of code upload. */
  upload (data: Uint8Array, meta?: Partial<Uploadable>): Promise<Uploaded> {
    this.log.warn('Agent#upload: this function is stub; use a subclass of Agent')
    return Promise.resolve({
      chainId:  this.chain!.id,
      codeId:   '0',
      codeHash: ''
    })
  }
  /** Stub implementation of contract init */
  instantiate <C extends Client> (instance: Contract<C>): PromiseLike<Instantiated> {
    this.log.warn('Agent#instantiate: this function is stub; use a subclass of Agent')
    return Promise.resolve({
      chainId:  this.chain!.id,
      address:  '',
      codeHash: '',
      label:    ''
    })
  }
  /** Stub implementation of calling a mutating method. */
  execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown> {
    this.log.warn('Agent#execute: this function is stub; use a subclass of Agent')
    return Promise.resolve({})
  }
}

/** @returns the agent of a thing
  * @throws  FadromaError.Missing.Agent */
export function assertAgent <A extends Agent> (thing: { agent?: A|null } = {}): A {
  if (!thing.agent) throw new Error.Missing.Agent(thing.constructor?.name)
  return thing.agent
}

/** A constructor for a Bundle subclass. */
export interface BundleClass<B extends Bundle> extends Class<B, ConstructorParameters<typeof Bundle>>{}

/** Bundle is an alternate executor that collects collects messages to broadcast
  * as a single transaction in order to execute them simultaneously. For that, it
  * uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.bundle().wrap(async bundle=>{ client.as(bundle).exec(...) })
  * */
export abstract class Bundle implements Agent {
  /** Messages in this bundle, unencrypted. */
  msgs: any[] = []
  /** Next message id. */
  id = 0
  /** Nested bundles are flattened, this counts the depth. */
  depth = 0

  constructor (
    /** The agent that will execute the batched transaction. */
    public agent: Agent,
    /** Evaluating this defines the contents of the bundle. */
    public callback?: (bundle: Bundle)=>unknown
  ) {
    if (!agent) throw new Error.Missing.Agent('for bundle')
  }

  get [Symbol.toStringTag]() { return `(${this.msgs.length}) ${this.address}` }

  get log () {
    return new Console(`${this.address} @ ${this.chain?.id} (batched: ${this.msgs.length})`)
  }

  get ready () { return this.agent.ready.then(()=>this) }

  get chain () { return this.agent.chain }

  get address () { return this.agent.address }

  get name () { return `${this.agent.name} (batched)` }

  get fees () { return this.agent.fees }

  get defaultDenom () { return this.agent.defaultDenom }

  get getUploader () { return this.agent.getUploader.bind(this) }

  get getClient () { return this.agent.getClient.bind(this) }

  /** Add a message to the bundle. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  /** Either submit or save the bundle. */
  async run (opts: ExecOpts|string = "", save: boolean = false): Promise<any> {
    this.log(save ? 'Saving' : 'Submitting')
    if (typeof opts === 'string') opts = { memo: opts }
    const { memo = '' } = opts ?? {}
    if (this.depth > 0) {
      this.log.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null as any // result ignored
    } else if (save) {
      return this.save(memo)
    } else {
      return this.submit(memo)
    }
  }

  /** Broadcast a bundle to the chain. */
  async submit (memo?: string): Promise<unknown> {
    this.log.warn('Bundle#submit: this function is stub; use a subclass of Bundle')
    if (memo) this.log.info('Memo:', memo)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Save a bundle for manual broadcast. */
  async save (name?: string): Promise<unknown> {
    this.log.warn('Bundle#save: this function is stub; use a subclass of Bundle')
    if (name) this.log.info('Name:', name)
    await this.agent.ready
    if (this.callback) await Promise.resolve(this.callback(this))
    this.callback = undefined
    return this.msgs.map(()=>({}))
  }

  /** Throws if the bundle is invalid. */
  assertMessages (): any[] {
    if (this.msgs.length < 1) {
      this.log.emptyBundle()
      throw new Error('Bundle contained no messages.')
    }
    return this.msgs
  }

  /** Add an init message to the bundle.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   the unmodified input. */
  async instantiate <C extends Client> (instance: Contract<C>) {
    const label    = instance.label
    const codeId   = String(instance.codeId)
    const codeHash = instance.codeHash
    const sender   = this.address
    const msg = instance.initMsg = await into(instance.initMsg)
    this.add({ init: { codeId, codeHash, label, msg, sender, funds: [] } })
    this.log('added instantiate message')
    return {
      chainId:  this.agent.chain!.id,
      address:  '(bundle not submitted)',
      codeHash: codeHash!,
      label:    label!,
      initBy:   this.address,
    }
  }
  /** Add multiple init messages to the bundle.
    * @example
    *   await agent.bundle().wrap(async bundle=>{
    *     await bundle.instantiateMany(template.instances({
    *       One: { label, initMsg },
    *       Two: { label, initMsg },
    *     }))
    *     await agent.instantiateMany({
    *       One: template1.instance({ label, initMsg }),
    *       Two: template2.instance({ label, initMsg }),
    *     })
    *   })
    * @returns
    *   the unmodified inputs. */
  async instantiateMany <C extends Many<AnyContract>> (inputs: C): Promise<C> {
    this.log(`adding ${Object.values(inputs).length} instantiate messages`)
    const outputs: any = (inputs instanceof Array) ? [] : {}
    await Promise.all(Object.entries(inputs).map(async ([key, instance]: [Name, AnyContract])=>{
      outputs[key] = instance.address ? instance : await this.instantiate(instance)
    }))
    return outputs
  }
  /** Add an exec message to the bundle. */
  async execute (
    { address, codeHash }: Partial<Client>,
    msg: Message,
    { send }: ExecOpts = {}
  ): Promise<this> {
    this.add({ exec: { sender: this.address, contract: address, codeHash, msg, funds: send } })
    this.log(`added execute message`)
    return this
  }
  /** Queries are disallowed in the middle of a bundle because
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Client, msg: Message): Promise<never> {
    throw new Error.Invalid.Batching("query")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (data: Uint8Array, meta?: Partial<Uploadable>): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (uploadables: Uploadable[] = []): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get balance (): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new Error.Invalid.Batching("query block height inside bundle")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new Error.Invalid.Batching("wait for next block")
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getCodeId (address: Address) {
    return this.agent.getCodeId(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getLabel (address: Address) {
    return this.agent.getLabel(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getHash (address: Address|number) {
    return this.agent.getHash(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
  }
  /** Nested bundles are "flattened": trying to create a bundle
    * from inside a bundle returns the same bundle. */
  bundle <B extends Bundle> (cb?: BundleCallback<B>): B {
    if (cb) this.log.warn('Nested bundle callback ignored.')
    this.log.warn('Nest bundles with care. Depth:', ++this.depth)
    return this as unknown as B
  }
  /** Bundle class to use when creating a bundle inside a bundle.
    * @default self */
  Bundle = this.constructor as { new (agent: Agent): Bundle }
}

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

// The `any` types here are required because in this case
// Chain, Agent, and Bundle are abstract classes and TS complains.
// When implementing chain support, you don't need to use `as any`.
bindChainSupport(Chain, Agent, Bundle)

/** Set the `Chain.Agent` and `Agent.Bundle` static properties.
  * This is how a custom chain implementation knows how to use
  * the corresponding agent implementation, and likewise for bundles. */
export function bindChainSupport (Chain: Function, Agent: Function, Bundle: Function) {
  Object.assign(Chain, { Agent: Object.assign(Agent, { Bundle }) })
  return { Chain, Agent, Bundle }
}

/** Generate a random chain ID with a given prefix.
  * The default prefix is `fadroma-devnet-`. */
export const randomChainId = (prefix = `fadroma-devnet-`) =>
  `${prefix}${randomBytes(4).toString('hex')}`
