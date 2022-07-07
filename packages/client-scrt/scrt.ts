import {
  Agent,
  Bundle,
  Chain,
  Fee,
  Message,
  Template,
  Uint128
} from '@fadroma/client'

export abstract class ScrtChain extends Chain {
  isSecretNetwork = true
  defaultDenom    = ScrtGas.denom
}

export abstract class ScrtAgent extends Agent {

  fees = ScrtGas.defaultFees

  async instantiateMany (configs: [Template, string, Message][] = []) {
    // instantiate multiple contracts in a bundle:
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

export abstract class ScrtBundle extends Bundle {}

export interface ScrtBundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

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

  constructor (amount: Uint128|number) {
    super(amount, ScrtGas.denom)
  }

}

export * from '@fadroma/client'
export * from './scrt-permit'
export * from './scrt-vk'
