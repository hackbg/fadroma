import {
  Address,
  Agent,
  Bundle,
  BundleCallback,
  Chain,
  Client,
  ClientCtor,
  ClientOptions,
  ExecOpts,
  Fee,
  Instance,
  Label,
  Message,
  Template,
  Uint128
} from '@fadroma/client'

export abstract class ScrtAgent extends Agent {

  fees = ScrtGas.defaultFees

  defaultDenom = 'uscrt'

  async instantiateMany (configs: [Template, string, Message][] = []) {
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

export class ScrtBundle extends Bundle {

  depth = 0

  bundle () {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  //@ts-ignore
  async wrap (cb: BundleCallback<this>, opts = { memo: "" }): Promise<any[]> {
    await cb(this)
    return this.run(opts.memo)
  }

  run (memo = ""): Promise<any> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      //@ts-ignore
      return null
    } else {
      return this.submit(memo)
    }
  }

  id = 0

  msgs: any[] = []

  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  getClient <C extends Client, O extends ClientOptions> (
    Class: ClientCtor<C, O>, options: Address|O
  ): C {
    //@ts-ignore
    return new Class(this, options)
  }

  get name () {
    return `${this.agent.name}@BUNDLE`
  }

  get balance () {
    throw new Error("don't query inside bundle")
    return Promise.resolve('0')
  }

  async getBalance (denom: string) {
    throw new Error("can't get balance in bundle")
    return Promise.resolve('0')
  }

  get defaultDenom () {
    return this.agent.defaultDenom
  }

  /** Add a single MsgInstantiateContract to the bundle. */
  async instantiate (
    template: Template, label: Label, msg: Message, init_funds = []
  ): Promise<Instance> {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    // @ts-ignore
    return { chainId: this.agent.chain.id, codeId, codeHash, address: null }
  }

  /** Add multiple MsgInstantiateContract messages to the bundle,
    * one for each contract config. */
  async instantiateMany (configs: [Template, Label, Message][]) {
    return await Promise.all(configs.map(([template, label, initMsg])=>
      this.instantiate(template, label, initMsg)))
  }

  async init (template: Template, label: Label, msg: Message, funds = []) {
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

  //@ts-ignore
  async execute (instance: Instance, msg: Message, { send }: ExecOpts = {}): Promise<this> {
    this.add({ exec: {
      sender:   this.address,
      contract: instance.address,
      codeHash: instance.codeHash,
      msg,
      funds: send
    } })
    return this
  }

  assertCanSubmit () {
    if (this.msgs.length < 1) {
      throw new Error('Trying to submit bundle with no messages')
    }
  }

  submit (memo: string): Promise<any> {
    throw new Error("ScrtBundle#submit is abstract, why aren't you using the subclass?")
  }

  save (name: string) {
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

export abstract class ScrtChain extends Chain {}

export interface ScrtBundleCtor <B extends ScrtBundle, R> {
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

  constructor (amount: Uint128|number) {
    super(amount, ScrtGas.denom)
  }

}

export * from '@fadroma/client'
export * from './scrt-permit'
export * from './scrt-vk'
