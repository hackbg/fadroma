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

    Object.defineProperty(this.log, 'label', {
      enumerable: true,
      get: () => `${this.id} @ ${this.url}`
    })

    Object.defineProperty(this, 'Agent', {
      enumerable: false,
      writable: true
    })

  }

  /** Logger. */
  log = new Console('@fadroma/agent: Chain')

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

  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string

  /** Get the current block height. */
  abstract get height (): Promise<number>

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
    return new (this as any)({ ...options, mode: Chain.Mode.Devnet })
  }

  /** @returns a mocknet instance of this chain. */
  static mocknet (options?: Partial<Chain>): Chain {
    throw new Error('Mocknet is not enabled for this chain.')
  }

}

export class StubChain extends Chain {

  defaultDenom = 'stub'

  getApi (): {} {
    this.log.warn('chain.getApi: this function is stub; use a subclass of Chain')
    return Promise.resolve({})
  }

  /** Get the current block height. */
  get height (): Promise<number> {
    this.log.warn('chain.height: this getter is stub; use a subclass of Chain')
    return Promise.resolve(+ new Date())
  }

  /** Stub implementation of getting native balance. */
  getBalance (denom: string, address: Address): Promise<string> {
    this.log.warn('chain.getBalance: this function is stub; use a subclass of Chain')
    return Promise.resolve('0')
  }

  /** Stub implementation of querying a smart contract. */
  query <U> (contract: Client, msg: Message): Promise<U> {
    this.log.warn('chain.query: this function is stub; use a subclass of Chain')
    return Promise.resolve({} as U)
  }

  /** Stub implementation of getting a code id. */
  getCodeId (address: Address): Promise<CodeId> {
    this.log.warn('chain.getCodeId: this function is stub; use a subclass of Chain')
    return Promise.resolve('code-id-stub')
  }

  /** Stub implementation of getting a code hash. */
  getHash (address: Address|number): Promise<CodeHash> {
    this.log.warn('chain.getHash: this function is stub; use a subclass of Chain')
    return Promise.resolve('code-hash-stub')
  }

  /** Stub implementation of getting a contract label. */
  getLabel (address: Address): Promise<string> {
    this.log.warn('chain.getLabel: this function is stub; use a subclass of Chain')
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
  Batch: BatchClass<Batch> // static
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {

  /** Logger. */
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

  /** The Batch subclass to use. */
  Batch:     BatchClass<Batch> = (this.constructor as AgentClass<typeof this>).Batch

  /** The default Batch class used by this Agent. */
  static Batch: BatchClass<Batch> // populated below

  constructor (options: Partial<Agent> = {}) {
    this.chain   = options.chain ?? this.chain
    this.name    = options.name  ?? this.name
    this.fees    = options.fees  ?? this.fees
    this.address = options.address  ?? this.address
    hide(this, 'chain', 'address', 'log', 'Batch')
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

  /** Upload a contract's code, generating a new code id/hash pair. */
  async upload (uploadable: string|URL|Uint8Array|Partial<Uploadable>): Promise<Uploaded> {
    const fromPath = async (path: string) => {
      const { readFile } = await import('node:fs/promises')
      return await readFile(path)
    }
    const fromURL = async (url: URL) => {
      if (url.protocol === 'file:') {
        const { fileURLToPath } = await import('node:url')
        return await fromPath(fileURLToPath(url))
      } else {
        return new Uint8Array(await (await fetch(url)).arrayBuffer())
      }
    }
    let data: Uint8Array
    const t0 = + new Date()
    if (typeof uploadable === 'string') {
      data = await fromPath(uploadable)
    } else if (uploadable instanceof URL) {
      data = await fromURL(uploadable)
    } else if (uploadable instanceof Uint8Array) {
      data = uploadable
    } else if (uploadable.artifact) {
      uploadable = uploadable.artifact
      if (typeof uploadable === 'string') {
        data = await fromPath(uploadable)
      } else if (uploadable instanceof URL) {
        data = await fromURL(uploadable)
      }
    } else {
      throw new Error('Invalid argument passed to Agent#upload')
    }
    const result = this.doUpload(data!)
    this.log.debug(`Uploaded in ${t0}msec:`, result)
    return result
  }

  protected abstract doUpload (data: Uint8Array): Promise<Uploaded>

  /** Get an uploader instance which performs code uploads and optionally caches them. */
  getUploader <U extends Uploader> ($U: UploaderClass<U>, options?: Partial<U>): U {
    return new $U({ agent: this, ...options||{} }) as U
  }

  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   AnyContract with no `address` populated yet.
    *   This will be populated after executing the batch. */
  abstract instantiate <C extends Client> (instance: Contract<C>): PromiseLike<Instantiated>

  /** Create multiple smart contracts from a Template (providing code id)
    * and a list or map of label/initmsg pairs.
    * Uses this agent's Batch class to instantiate them in a single transaction.
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
    const batch = this.batch((batch: any)=>batch.instantiateMany(instances))
    const response = await batch.run()
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

  /** Execute a transaction batch.
    * @returns Batch if called with no arguments
    * @returns Promise<any[]> if called with Batch#wrap args */
  batch <B extends Batch> (cb?: BatchCallback<B>): B {
    return new this.Batch(this, cb as BatchCallback<Batch>) as unknown as B
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
  protected doUpload (data: Uint8Array): Promise<Uploaded> {
    this.log.warn('Agent#upload: this function is stub; use a subclass of Agent')
    return Promise.resolve({
      chainId:  this.chain!.id,
      codeId:   '0',
      codeHash: 'stub-code-hash'
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

/** A constructor for a Batch subclass. */
export interface BatchClass<B extends Batch> extends Class<B, ConstructorParameters<typeof Batch>>{}

type BatchAgent = Omit<Agent, 'doUpload'|'ready'> & { ready: Promise<Batch> }

/** Batch is an alternate executor that collects messages to broadcast
  * as a single transaction in order to execute them simultaneously.
  * For that, it uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.batch().wrap(async batch=>{ client.as(batch).exec(...) }) */
export abstract class Batch implements BatchAgent {
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
    if (!agent) throw new Error.Missing.Agent('for batch')
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

  /** Add a message to the batch. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  /** Either submit or save the batch. */
  async run (opts: ExecOpts|string = "", save: boolean = false): Promise<any> {
    this.log(save ? 'Saving' : 'Submitting')
    if (typeof opts === 'string') opts = { memo: opts }
    const { memo = '' } = opts ?? {}
    if (this.depth > 0) {
      this.log.warn('Unnesting batch. Depth:', --this.depth)
      this.depth--
      return null as any // result ignored
    } else if (save) {
      return this.save(memo)
    } else {
      return this.submit(memo)
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

  /** Add an init message to the batch.
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
      address:  '(batch not submitted)',
      codeHash: codeHash!,
      label:    label!,
      initBy:   this.address,
    }
  }
  /** Add multiple init messages to the batch.
    * @example
    *   await agent.batch().wrap(async batch=>{
    *     await batch.instantiateMany(template.instances({
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
  /** Add an exec message to the batch. */
  async execute (
    { address, codeHash }: Partial<Client>,
    msg: Message,
    { send }: ExecOpts = {}
  ): Promise<this> {
    this.add({ exec: { sender: this.address, contract: address, codeHash, msg, funds: send } })
    this.log(`added execute message`)
    return this
  }
  /** Queries are disallowed in the middle of a batch because
    * even though the batch API is structured as multiple function calls,
    * the batch is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Client, msg: Message): Promise<never> {
    throw new Error.Invalid.Batching("query")
  }
  /** Uploads are disallowed in the middle of a batch because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (data: Uint8Array): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  async doUpload (data: Uint8Array): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Uploads are disallowed in the middle of a batch because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (uploadables: Uploadable[] = []): Promise<never> {
    throw new Error.Invalid.Batching("upload")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get balance (): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new Error.Invalid.Batching("query block height inside batch")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new Error.Invalid.Batching("wait for next block")
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getCodeId (address: Address) {
    return this.agent.getCodeId(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getLabel (address: Address) {
    return this.agent.getLabel(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  getHash (address: Address|number) {
    return this.agent.getHash(address)
  }
  /** This doesnt change over time so it's allowed when building batches. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new Error.Invalid.Batching("query balance")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
  }
  /** Disallowed in batch - do it beforehand or afterwards. */
  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.Invalid.Batching("send")
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

/** Function passed to Batch#wrap */
export type BatchCallback<B extends Batch> = (batch: B)=>Promise<void>

// The `any` types here are required because in this case
// Chain, Agent, and Batch are abstract classes and TS complains.
// When implementing chain support, you don't need to use `as any`.
bindChainSupport(Chain, Agent, Batch)
bindChainSupport(StubChain, StubAgent, Batch)

/** Set the `Chain.Agent` and `Agent.Batch` static properties.
  * This is how a custom chain implementation knows how to use
  * the corresponding agent implementation, and likewise for batches. */
export function bindChainSupport (Chain: Function, Agent: Function, Batch: Function) {
  Object.assign(Chain, { Agent: Object.assign(Agent, { Batch }) })
  return { Chain, Agent, Batch }
}

/** Generate a random chain ID with a given prefix.
  * The default prefix is `fadroma-devnet-`. */
export const randomChainId = (prefix = `fadroma-devnet-`) =>
  `${prefix}${randomBytes(4).toString('hex')}`
