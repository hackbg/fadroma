import { Console, Error, Config, Chain, Agent, Bundle } from './cw-base'

class OKP4Config extends Config {
  static defaultTestnetChainId: string = 'okp4-nemeton-1'
  static defaultTestnetUrl: string = 'https://api.testnet.okp4.network/'
  testnetChainId: string = this.getString(
    'FADROMA_OKP4_TESTNET_CHAIN_ID', () => OKP4Config.defaultTestnetChainId)
  testnetUrl: string = this.getString(
    'FADROMA_OKP4_TESTNET_URL', () => OKP4Config.defaultTestnetUrl)
}

/** OKP4 chain. */
class OKP4Chain extends Chain {
  defaultDenom = 'uknow'
  log = new Console('OKP4')
}

/** Agent for OKP4. */
class OKP4Agent extends Agent {}

/** Transaction bundle for OKP4. */
class OKP4Bundle extends Bundle {}
