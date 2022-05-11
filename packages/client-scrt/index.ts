import {
  Gas, Fees,
  Chain, ChainOptions,
  Executor, Agent, AgentOptions,
  Template,
  Instance, Client, ClientCtor, ClientOptions,
} from '@fadroma/client'

import * as constants from './constants'

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

export abstract class ScrtAgent extends Agent {

  abstract Bundle: ScrtBundleCtor<any>

  /** Start a new transaction bundle. */
  bundle () {
    if (!this.Bundle) {
      throw new Error(constants.ERR_NO_BUNDLE)
    }
    return new this.Bundle(this)
  }

  fees = ScrtGas.defaultFees

  defaultDenomination = 'uscrt'

  /** Instantiate multiple contracts from a bundled transaction. */
  async instantiateMany (
    configs: [Template, string, object][],
  ): Promise<Instance[]> {
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const [template, label, initMsg] = configs[i]
      const instance = instances[i]
      if (instance) {
        instance.codeHash = template.codeHash
      }
    }
    return instances
  }

}

export interface ScrtBundleCtor <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

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

  /** Populate and execute bundle */
  async wrap (cb: ScrtBundleWrapper, memo: string = "") {
    await cb(this)
    return this.run(memo)
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

  protected id: number = 0

  protected msgs: Array<any> = []

  /** Add a message to the bundle, incrementing
    * the bundle's internal message counter. */
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

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
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
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

  /** Add a single MsgInstantiateContract to the bundle. */
  async instantiate (template: Template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  /** Add multiple MsgInstantiateContract messages to the bundle,
    * one for each contract config. */
  async instantiateMany (
    configs: [Template, string, object][],
  ): Promise<Record<string, Instance>> {
    const instances = {}
    // add each init tx to the bundle. when passing a single contract
    // to instantiate, this should behave equivalently to non-bundled init
    for (let [template, label, initMsg] of configs) {
      console.info('Instantiate:', label)
      instances[label] = await this.instantiate(template, label, initMsg)
    }
    return instances
  }

  async init (template: Template, label, msg, funds = []): Promise<this> {
    this.add({ init: {
      sender:   this.address,
      codeId:   String(template.codeId),
      codeHash: template.codeHash,
      label,
      msg,
      funds
    }})
    return this
  }

  async execute (instance: Instance, msg, funds = []): Promise<this> {
    this.add({ exec: {
      sender:   this.address,
      contract: instance.address,
      codeHash: instance.codeHash,
      msg,
      funds
    } })
    return this
  }

  protected assertCanSubmit () {
    if (this.msgs.length < 1) {
      throw new Error('Trying to submit bundle with no messages')
    }
  }

  abstract submit (memo: string): Promise<ScrtBundleResult[]>

  abstract save (name: string): Promise<void>

}

export function mergeAttrs (attrs: {key:string,value:string}[]): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

export * from '@fadroma/client'
