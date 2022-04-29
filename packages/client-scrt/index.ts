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

export class ScrtChain extends Chain {
  static Mainnet = class ScrtMainnet extends ScrtChain {
    mode = Chain.Mode.Mainnet
  }
  static Testnet = class ScrtTestnet extends ScrtChain {
    mode = Chain.Mode.Testnet
  }
  static Devnet  = class ScrtDevnet extends ScrtChain {
    mode = Chain.Mode.Devnet
  }
  static Mocknet = class ScrtMocknet extends ScrtChain {
    mode = Chain.Mode.Mocknet
  }
}

export * from '@fadroma/client'
