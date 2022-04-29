import {
  Executor, Agent,
  Template, Instance,
  Client, ClientCtor, ClientOptions
} from '@fadroma/client'

export type BundleWrapper = (bundle: Bundle) => Promise<any>

export interface BundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

export abstract class Bundle implements Executor {

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
  run (memo: string): Promise<BundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }

  async wrap (cb: BundleWrapper) {
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

  abstract instantiateMany (
    configs: [Template, string, object][],
    prefix?: string,
    suffix?: string
  ): Promise<Record<string, Instance>>

  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    throw new Error("don't query inside bundle")
  }

  abstract execute <T, U> (instance: Instance, msg: T): Promise<U>

  abstract submit (memo: string): Promise<BundleResult[]>

  abstract save (name: string): Promise<void>

  getClient <C extends Client> (
    Client:  ClientCtor<C>,
    options: ClientOptions
  ): C {
    return new Client(this, options)
  }

  get chain (): Scrt {
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

}
