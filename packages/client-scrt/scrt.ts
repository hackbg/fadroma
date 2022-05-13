import { Agent, Chain, Fee } from '@fadroma/client'

import * as constants from './scrt-const'

export class ScrtAgent extends Agent {

  Bundle = null

  bundle () {
    if (!this.Bundle) {
      throw new Error(constants.ERR_NO_BUNDLE)
    }
    return new this.Bundle(this)
  }

  fees = ScrtGas.defaultFees

  defaultDenomination = 'uscrt'

  async instantiateMany (configs) {
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const [{ codeId, codeHash }, label] = configs[i]
      const instance = instances[i]
      if (instance) {
        instance.codeId   = codeId
        instance.codeHash = codeHash
        instance.label    = label
      }
    }
    return instances
  }

}

export class ScrtBundle {

  constructor (readonly agent) {}

  depth = 0

  bundle () {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  async wrap (cb, memo = "") {
    await cb(this)
    return this.run(memo)
  }

  run (memo = "") {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }

  id = 0

  msgs = []

  add (msg) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  getClient (Client, options) {
    return new Client(this, options)
  }

  getCodeId (address) {
    return this.agent.getCodeId(address)
  }

  get chain () {
    return this.agent.chain
  }

  get name () {
    return `${this.agent.name}@BUNDLE`
  }

  get address () {
    return this.agent.address
  }

  getLabel (address) {
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
  async query () {
    throw new Error("don't query inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload () {
    throw new Error("don't upload inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany () {
    throw new Error("don't upload inside bundle")
  }

  /** Add a single MsgInstantiateContract to the bundle. */
  async instantiate (template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  /** Add multiple MsgInstantiateContract messages to the bundle,
    * one for each contract config. */
  async instantiateMany (configs) {
    return await Promise.all(configs.map(([template, label, initMsg])=>
      this.instantiate(template, label, initMsg)))
  }

  async init (template, label, msg, funds = []) {
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

  async execute (instance, msg, funds = []) {
    this.add({ exec: {
      sender:   this.address,
      contract: instance.address,
      codeHash: instance.codeHash,
      msg,
      funds
    } })
    return this
  }

  assertCanSubmit () {
    if (this.msgs.length < 1) {
      throw new Error('Trying to submit bundle with no messages')
    }
  }

  submit (memo) {
    throw new Error("ScrtBundle#submit is abstract, why aren't you using the subclass?")
  }

  save (name) {
    throw new Error("ScrtBundle#save is abstract, why aren't you using the subclass?")
  }

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

export class ScrtChain extends Chain {}

export interface ScrtBundleCtor <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

export class ScrtGas extends Fee {

  static denom = 'uscrt'

  static defaultFees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }

  constructor (x) {
    super(x, ScrtGas.denom)
  }

}

export function mergeAttrs (attrs) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

export * from '@fadroma/client'
export * from './scrt-permit'
export * from './scrt-vk'
