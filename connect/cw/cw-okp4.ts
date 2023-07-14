import { Console, Error, Config, Chain, Agent, Bundle } from './cw-base'
import type { AgentClass } from '@fadroma/agent'
import { StargateClient } from '@cosmjs/stargate'

class OKP4Config extends Config {
  static defaultTestnetChainId: string =
    'okp4-nemeton-1'
  static defaultTestnetUrl: string =
    'https://okp4-testnet-rpc.polkachu.com/'
    //'https://okp4-testnet-api.polkachu.com/'
  testnetChainId: string = this.getString(
    'FADROMA_OKP4_TESTNET_CHAIN_ID', () => OKP4Config.defaultTestnetChainId)
  testnetUrl: string = this.getString(
    'FADROMA_OKP4_TESTNET_URL', () => OKP4Config.defaultTestnetUrl)
}

/** OKP4 chain. */
class OKP4Chain extends Chain {
  declare Agent: AgentClass<OKP4Agent>
  defaultDenom = 'uknow'
  log = new Console('OKP4Chain')

  /** Connect to OKP4 in testnet mode. */
  static testnet = (options: Partial<OKP4Chain> = {}): OKP4Chain => super.testnet({
    id:  OKP4Config.defaultTestnetChainId,
    url: OKP4Config.defaultTestnetUrl,
    ...options||{},
  }) as OKP4Chain
}

/** Agent for OKP4. */
class OKP4Agent extends Agent {
  declare chain: OKP4Chain
  log = new Console('OKP4Agent')
  api?: StargateClient
  constructor (options: Partial<OKP4Agent> = {}) {
    super(options)
    this.fees      = options.fees ?? this.fees
    this.api       = options.api ?? this.api
    this.mnemonic  = options.mnemonic ?? this.mnemonic
    this.log.label = `${this.address??'(no address)'} @ ${this.chain?.id??'(no chain id)'}`
  }
  get ready (): Promise<this & { api: StargateClient }> {
    if (this.api) return Promise.resolve(this) as Promise<this & { api: StargateClient }>
    return StargateClient.connect(this.chain.url).then(api=>Object.assign(this, { api }))
  }
}

/** Transaction bundle for OKP4. */
class OKP4Bundle extends Bundle {
}

export const testnet = OKP4Chain.testnet

Object.assign(OKP4Chain, { Agent: OKP4Agent })

export {
  OKP4Config as Config,
  OKP4Chain  as Chain,
  OKP4Agent  as Agent,
  OKP4Bundle as Bundle
}
