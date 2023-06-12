import { Config } from '@hackbg/conf'
import { Chain, Agent, Bundle, Fee, Console, Error, bold, Mocknet } from '@fadroma/agent'
import type { AgentClass, AgentFees, BundleClass, Uint128 } from '@fadroma/agent'

class CosmosConfig extends Config {
  /** The mainnet chain ID. */
  static defaultMainnetChainId: string = ''
  /** The mainnet URL. */
  static defaultMainnetUrl:     string = ''
  /** The testnet chain ID. */
  static defaultTestnetChainId: string = ''
  /** The testnet URL. */
  static defaultTestnetUrl:     string = ''
}

class CosmosError extends Error {}

class CosmosConsole extends Console {}

class CosmosChain extends Chain {
  log = new CosmosConsole('Cosmos')

  static defaultDenom = 'uatom'
  defaultDenom = CosmosChain.defaultDenom

  static Agent: AgentClass<CosmosAgent> = CosmosChain.Agent
  Agent: AgentClass<CosmosAgent> = CosmosChain.Agent

  /** @returns a fresh instance of the anonymous read-only API client. */
  async getApi (options: any = {}): Promise<any> {}

  /** @returns Fee in uatom */
  static gas = (amount: Uint128|number) => new Fee(amount, this.defaultDenom)
  /** Connect to the Secret Network Mainnet. */
  static mainnet = (options: Partial<CosmosChain> = {}): CosmosChain => super.mainnet({
    id:  CosmosConfig.defaultMainnetChainId,
    url: CosmosConfig.defaultMainnetUrl,
    ...options||{},
  }) as CosmosChain
  /** Connect to the Secret Network Testnet. */
  static testnet = (options: Partial<CosmosChain> = {}): CosmosChain => super.testnet({
    id:  CosmosConfig.defaultTestnetChainId,
    url: CosmosConfig.defaultTestnetUrl,
    ...options||{},
  }) as CosmosChain
  /** Connect to a Secret Network devnet. */
  static devnet = (options: Partial<CosmosChain> = {}): CosmosChain => super.devnet({
    ...options||{},
  }) as CosmosChain
  /** Create to a Secret Network mocknet. */
  static mocknet = (options: Partial<Mocknet.Chain> = {}): Mocknet.Chain => super.mocknet({
    id: 'scrt-mocknet',
    ...options||{}
  })
  /** Set permissive fees by default. */
  static defaultFees: AgentFees = {
    upload: this.gas(2000000),
    init:   this.gas(2000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }
}

class CosmosAgent extends Agent {
  log = new CosmosConsole('CosmosAgent')
  declare chain: CosmosChain
  Bundle: BundleClass<CosmosBundle> = CosmosBundle
  fees = CosmosChain.defaultFees

  get ready (): Promise<this> {
    return Promise.resolve(this)
  }
}

class CosmosBundle extends Bundle {}

Object.assign(CosmosChain, { Agent: Object.assign(CosmosAgent, { Bundle: CosmosBundle }) })

export {
  CosmosConfig  as Config,
  CosmosError   as Error,
  CosmosConsole as Console,
  CosmosChain   as Chain,
  CosmosBundle  as Bundle,
  CosmosAgent   as Agent
}
