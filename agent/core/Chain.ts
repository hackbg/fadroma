import type {
  Class, Address, Message, ExecOpts, AgentFees, ICoin, IFee, CodeHash, Client, ClientClass,
  Uploaded, Instantiated, AnyContract, Contract, Uploader, UploaderClass, Name, Many, CodeId
} from '../index'

import { Error, Console, into } from '../util'

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
  chainId: string
  url: URL
  respawn (): Promise<unknown>
  terminate (): Promise<this>
  getGenesisAccount (name: string): Promise<AgentOpts>
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
  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string
  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentClass<Agent> = (this.constructor as ChainClass<unknown>).Agent
  /** The default Agent subclass to use for interacting with this chain. */
  static Agent: AgentClass<Agent> // populated below
  /** Shorthand for the ChainMode enum. */
  static Mode = ChainMode
  /** Create a mainnet instance of this chain. */
  static mainnet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Mainnet })
  }
  /** Create a testnet instance of this chain. */
  static testnet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Testnet })
  }
  /** Create a devnet instance of this chain. */
  static devnet (options: Partial<Chain> = {}): Chain {
    options = { ...options }
    if (options.devnet) {
      options.id  ??= options.devnet.chainId
      options.url ??= options.devnet.url.toString()
    }
    return new (this as any)({ ...options, mode: Chain.Mode.Devnet })
  }
  /** Create a mocknet instance of this chain. */
  static mocknet (options: Partial<Chain> = {}): Chain {
    return new (this as any)({ ...options, mode: Chain.Mode.Mocknet })
  }
  /** Async functions that return Chain instances in different modes.
    * Values for `FADROMA_CHAIN` environment variable. */
  static variants: ChainRegistry = {}

  constructor (options: Partial<Chain> = {}) {
    if (!(this.id = options.id!)) throw new Error.NoChainId()
    this.url  = options.url ?? this.url
    this.mode = options.mode!
    if (options.devnet) {
      if (options.mode === Chain.Mode.Devnet) {
        this.devnet = options.devnet
        if (this.url !== String(this.devnet.url)) {
          this.log.warnUrlOverride(this.devnet.url, this.url)
          this.url = String(this.devnet.url)
        }
        if (this.id !== this.devnet.chainId) {
          this.log.warnIdOverride(this.devnet.chainId, this.id)
          this.id = this.devnet.chainId
        }
      } else {
        this.log.warnNodeNonDevnet()
      }
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
  get isDevnet  () { return this.mode === ChainMode.Devnet  }
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
        this.log.warn('Current block height undetermined. Not waiting for next block')
        return Promise.resolve(NaN)
      }

      this.log.waitingForNextBlock(startingHeight)

      return new Promise(async (resolve, reject)=>{
        try {
          while (true) {
            await new Promise(ok=>setTimeout(ok, 250))
            this.log.info('Still waiting for block height to increment beyond', startingHeight)
            const height = await this.height
            if (height > startingHeight) {
              this.log.info('Block height incremented to', height, 'continuing')
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
  getBalance (denom: string, address: Address): Promise<string> {
    this.log.warn('Chain#getBalance: stub')
    return Promise.resolve('0')
  }
  /** Query a smart contract. */
  query <U> (contract: Client, msg: Message): Promise<U> {
    this.log.warn('Chain#query: stub')
    return Promise.resolve({} as U)
  }
  /** Get the code id of a smart contract. */
  getCodeId (address: Address): Promise<CodeId> {
    this.log.warn('Chain#getCodeId: stub')
    return Promise.resolve('code-id-stub')
  }
  /** Get the code hash of a smart contract. */
  getHash (address: Address|number): Promise<CodeHash> {
    this.log.warn('Chain#getHash: stub')
    return Promise.resolve('code-hash-stub')
  }
  /** Get the code hash of a smart contract. */
  async checkHash (address: Address, expectedCodeHash?: CodeHash) {
    // Soft code hash checking for now
    const fetchedCodeHash = await this.getHash(address)
    if (!expectedCodeHash) {
      this.log.warnNoCodeHashProvided(address, fetchedCodeHash)
    } if (expectedCodeHash !== fetchedCodeHash) {
      this.log.warnCodeHashMismatch(address, expectedCodeHash, fetchedCodeHash)
    } else {
      this.log.confirmCodeHash(address, fetchedCodeHash)
    }
    return fetchedCodeHash
  }
  /** Get the label of a smart contract. */
  getLabel (address: Address): Promise<string> {
    this.log.warn('Chain#getLabel: stub')
    return Promise.resolve('contract-label-stub')
  }
  /** Get a new instance of the appropriate Agent subclass. */
  getAgent (options?: Partial<AgentOpts>): Agent
  getAgent ($A: AgentClass<Agent>, options?: Partial<AgentOpts>): InstanceType<typeof $A>
  getAgent (...args: any) {
    const $A      = (typeof args[0] === 'function') ? args[0] : this.Agent
    const options = (typeof args[0] === 'function') ? args[1] : args[0]
    const agent   = new $A(Object.assign(options||{}, { chain: this }))
    return agent
  }
}

/** @returns the chain of a thing
  * @throws  ExpectedChain if missing. */
export function assertChain <C extends Chain> (thing: { chain?: C|null } = {}): C {
  if (!thing.chain) throw new Error.NoChain()
  return thing.chain
}

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Bundle: BundleClass<Bundle> // static
}

export interface AgentOpts {
  chain:     Chain
  name?:     string
  mnemonic?: string
  address?:  Address
  fees?:     AgentFees
  [key: string]: unknown
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  log = new Console('@fadroma/agent: Agent')
  /** The chain on which this agent operates. */
  chain?:    Chain
  /** The address from which transactions are signed and sent. */
  address?:  Address
  /** The wallet's mnemonic. */
  mnemonic?: string
  /** The friendly name of the agent. */
  name?:     string
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:     AgentFees
  /** The Bundle subclass to use. */
  Bundle:    BundleClass<Bundle> = (this.constructor as AgentClass<typeof this>).Bundle

  /** The default Bundle class used by this Agent. */
  static Bundle: BundleClass<Bundle> // populated below

  constructor (options: Partial<AgentOpts> = {}) {
    this.chain = options.chain ?? this.chain
    this.name = options.name  ?? this.name
    this.fees = options.fees  ?? this.fees
    this.address = options.address  ?? this.address
    Object.defineProperties(this, {
      'chain':    { enumerable: false, writable: true },
      'mnemonic': { enumerable: false, writable: true },
      'address':  { enumerable: false, writable: true },
      'log':      { enumerable: false, writable: true },
      'Bundle':   { enumerable: false, writable: true }
    })
  }

  get [Symbol.toStringTag]() {
    return `${this.chain?.id??'-'}: ${this.address}`
  }
  /** Complete the asynchronous initialization of this Agent. */
  get ready (): Promise<this> {
    const init = new Promise<this>(async (resolve, reject)=>{
      try {
        if (this.chain?.devnet) await this.chain?.devnet.respawn()
        if (!this.mnemonic && this.name) {
          if (!this.chain?.devnet) throw new Error.NameOutsideDevnet()
          Object.assign(this, await this.chain?.devnet.getGenesisAccount(this.name))
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
    if (!this.chain) throw new Error.NoChain()
    if (!address) throw new Error.BalanceNoAddress()
    return this.chain.getBalance(denom!, address)
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
  send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#send: stub')
    return Promise.resolve()
  }
  /** Send native tokens to multiple recipients. */
  sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#sendMany: stub')
    return Promise.resolve()
  }
  /** Upload code, generating a new code id/hash pair. */
  upload (blob: Uint8Array): Promise<Uploaded> {
    this.log.warn('Agent#upload: stub')
    return Promise.resolve({
      chainId:  this.chain!.id,
      codeId:   '0',
      codeHash: ''
    })
  }
  /** Upload multiple pieces of code, generating multiple CodeID/CodeHash pairs.
    * @returns Template[] */
  uploadMany (blobs: Uint8Array[] = []): Promise<Uploaded[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  /** Get an uploader instance which performs code uploads and optionally caches them. */
  getUploader <U extends Uploader> ($U: UploaderClass<U>, ...options: any[]): U {
    //@ts-ignore
    return new $U(this, ...options) as U
  }
  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.define({ label, initMsg })
    * @returns
    *   AnyContract with no `address` populated yet.
    *   This will be populated after executing the bundle. */
  instantiate <C extends Client> (instance: Contract<C>): PromiseLike<Instantiated> {
    this.log.warn('Agent#instantiate: stub')
    return Promise.resolve({
      chainId:  this.chain!.id,
      address:  '',
      codeHash: '',
      label:    ''
    })
  }
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
    const response = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(instances)
    })
    // Populate instances with resulting addresses
    for (const instance of Object.values(instances)) {
      if (instance.address) continue
      // Find result corresponding to instance
      const found = response.find(({ label })=>label===instance.label)
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
  execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown> {
    this.log.warn('Agent#execute: stub')
    return Promise.resolve({})
  }
  /** Query a contract on the chain. */
  query <R> (contract: Client, msg: Message): Promise<R> {
    return assertChain(this).query(contract, msg)
  }
  /** Begin a transaction bundle. */
  bundle (): Bundle {
    //@ts-ignore
    return new this.Bundle(this)
  }
}

/** @returns the agent of a thing
  * @throws  ExpectedAgent if missing. */
export function assertAgent <A extends Agent> (thing: { agent?: A|null } = {}): A {
  if (!thing.agent) throw new Error.ExpectedAgent(thing.constructor?.name)
  return thing.agent
}

/** A constructor for a Bundle subclass. */
export interface BundleClass<B extends Bundle> extends Class<B, ConstructorParameters<typeof Bundle>>{}

/** Bundle is an alternate executor that collects collects messages to broadcast
  * as a single transaction in order to execute them simultaneously. For that, it
  * uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.bundle().wrap(async bundle=>{ client.as(bundle).exec(...) })
  * */
export abstract class Bundle extends Agent {
  /** Logger. */
  log = new Console('@fadroma/agent: Bundle')
  /** Nested bundles are flattened, this counts the depth. */
  depth  = 0
  /** Bundle class to use when creating a bundle inside a bundle.
    * @default self */
  Bundle = this.constructor as { new (agent: Agent): Bundle }
  /** Messages in this bundle, unencrypted. */
  msgs: any[] = []
  /** Next message id. */
  id = 0

  constructor (readonly agent: Agent) {
    if (!agent) throw new Error.NoBundleAgent()
    super({ chain: agent.chain })
    this.address = this.agent.address
    this.name = `${this.agent.name}@BUNDLE`
    this.fees = this.agent.fees
  }

  get [Symbol.toStringTag]() { return `(${this.msgs.length}) [${this.address}]` }

  /** Add a message to the bundle. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  /** Nested bundles are flattened, i.e. trying to create a bundle
    * from inside a bundle returns the same bundle. */
  bundle (): this {
    this.log.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  /** Create and run a bundle.
    * @example
    *   await agent.bundle().wrap(async bundle=>{
    *     client1.as(bundle).doThing()
    *     bundle.getClient(SomeClient, address, codeHash).doAnotherThing()
    *   })
    * */
  async wrap (
    cb:   BundleCallback<this>,
    opts: ExecOpts = { memo: "" },
    save: boolean  = false
  ): Promise<any[]> {
    await cb(this)
    return this.run(opts.memo, save)
  }

  /** Either submit or save the bundle. */
  run (memo = "", save: boolean = false): Promise<any> {
    if (this.depth > 0) {
      this.log.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      //@ts-ignore
      return null
    } else {
      if (save) {
        return this.save(memo)
      } else {
        return this.submit(memo)
      }
    }
  }

  /** Throws if the bundle is invalid. */
  assertMessages (): any[] {
    if (this.msgs.length < 1) throw this.log.warnEmptyBundle()
    return this.msgs
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
  get balance (): Promise<string> {
    throw new Error.NotInBundle("query balance")
  }

  /** Disallowed in bundle - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new Error.NotInBundle("query balance")
  }

  /** Disallowed in bundle - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new Error.NotInBundle("query block height inside bundle")
  }

  /** Disallowed in bundle - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new Error.NotInBundle("wait for next block")
  }

  /** Disallowed in bundle - do it beforehand or afterwards. */
  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.NotInBundle("send")
  }

  /** Disallowed in bundle - do it beforehand or afterwards. */
  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error.NotInBundle("send")
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
    return {
      chainId:  this.chain!.id,
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
    const outputs: any = (inputs instanceof Array) ? [] : {}
    await Promise.all(Object.entries(inputs).map(
      async ([key, instance]: [Name, AnyContract])=>{
        outputs[key] = instance.address
          ? instance
          : await this.instantiate(instance) }))
    return outputs
  }

  /** Add an exec message to the bundle. */
  async execute (
    { address, codeHash }: Partial<Client>,
    msg: Message,
    { send }: ExecOpts = {}
  ): Promise<this> {
    this.add({ exec: { sender: this.address, contract: address, codeHash, msg, funds: send } })
    return this
  }

  /** Queries are disallowed in the middle of a bundle because
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Client, msg: Message): Promise<never> {
    throw new Error.NotInBundle("query")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (code: Uint8Array): Promise<never> {
    throw new Error.NotInBundle("upload")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (code: Uint8Array[] = []): Promise<never> {
    throw new Error.NotInBundle("upload")
  }

  /** Broadcast a bundle to the chain. */
  submit (memo: string): Promise<unknown> {
    this.log.warn('Bundle#submit: not implemented')
    return Promise.resolve([])
  }

  /** Save a bundle for manual broadcast. */
  save (name: string): Promise<unknown> {
    this.log.warn('Bundle#save: not implemented')
    return Promise.resolve()
  }

}


/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>
