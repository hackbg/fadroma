import {
  Gas, Fees,
  Chain, ChainOptions,
  Executor, Agent, AgentOptions,
  Template,
  Instance, Client, ClientCtor, ClientOptions
} from '@fadroma/client'

export class ScrtGas extends Gas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}

export class ScrtChain extends Chain {}

export type ScrtBundleWrapper = (bundle: ScrtBundle) => Promise<any>

export interface ScrtBundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

export abstract class ScrtBundle implements Executor {

  constructor (readonly agent: Agent) {}

  private depth = 0

  /** Opening a bundle from within a bundle
    * returns the same bundle with incremented depth. */
  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  /** Execute the bundle if not nested;
    * decrement the depth if nested. */
  run (memo: string): Promise<ScrtBundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }

  /** Populate and execute bundle */
  async wrap (cb: ScrtBundleWrapper) {
    await cb(this)
    return this.run("")
  }

  protected id: number = 0

  protected msgs: Array<any> = []

  /** Add a message to the bundle, incrementing
    * the bundle's internal message counter. */
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  abstract init <T> (
    template: Template,
    label:    string,
    msg:      T,
    send:     any[]
  ): Promise<this>

  getClient <C extends Client> (
    Client:  ClientCtor<C>,
    options: ClientOptions
  ): C {
    return new Client(this, options)
  }

  getCodeId (address) {
    return this.agent.getCodeId(address)
  }

  get chain (): ScrtChain {
    return this.agent.chain
  }

  get name () {
    return `${this.agent.name}@BUNDLE`
  }

  get address () {
    return this.agent.address
  }

  getLabel (address: string) {
    return this.agent.getLabel(address)
  }

  getHash (address) {
    return this.agent.getHash(address)
  }

  get balance () {
    throw new Error("don't query inside bundle")
    return Promise.resolve(0n)
  }

  async getBalance (denom) {
    throw new Error("can't get balance in bundle")
    return Promise.resolve(0n)
  }

  get defaultDenom () {
    return this.agent.defaultDenom
  }

  /** Queries are disallowed in the middle of a bundle because
    * they introduce dependencies on external state */
  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    throw new Error("don't query inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (data): Promise<Template> {
    throw new Error("don't upload inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (data): Promise<Template[]> {
    throw new Error("don't upload inside bundle")
  }

  abstract instantiate (
    template:    Template,
    label:       string,
    msg:         object,
    init_funds?: any[]
  )

  abstract instantiateMany (
    configs: [Template, string, object][],
    prefix?: string,
    suffix?: string
  ): Promise<Record<string, Instance>>

  abstract execute <T, U> (instance: Instance, msg: T): Promise<U>

  abstract submit (memo: string): Promise<ScrtBundleResult[]>

  abstract save (name: string): Promise<void>

}

export * from '@fadroma/client'
