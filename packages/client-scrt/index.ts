import { Gas, Fees, Chain, ChainOptions, Agent, AgentOptions } from '@fadroma/client'

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

export interface DevnetHandle {
  terminate:         () => Promise<void>
  getGenesisAccount: (name: string) => Promise<AgentOptions>
}

export interface DevnetChainOptions extends ChainOptions {
  node: DevnetHandle
}

export class ScrtChain extends Chain {}

export * from '@fadroma/client'
