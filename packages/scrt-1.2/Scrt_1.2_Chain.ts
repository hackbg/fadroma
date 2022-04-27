import { URL } from 'url'
import { Chain, Scrt, Console, ChainMode, scrtConfig as config } from '@fadroma/scrt'

import { getScrt_1_2_Devnet } from './Scrt_1.2_Devnet'
import { ScrtAgent } from './Scrt_1.2_Agent'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1.2_Patch'
import { SigningCosmWasmClient } from 'secretjs'

const console = Console('@fadroma/scrt')

export const {
  // remotenet options
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
} = process.env

export class Scrt_1_2 extends Scrt {
  async getAgent (identity = config.scrt.defaultIdentity): Promise<typeof this.Agent> {
    return (await super.getAgent(identity)) as unknown as typeof this.Agent
  }
  async getNonce (address: string): Promise<ScrtNonce> {
    const sign = () => {throw new Error('unreachable')}
    const client = new SigningCosmWasmClient(this.apiURL.toString(), address, sign)
    const { accountNumber, sequence } = await client.getNonce()
    return { accountNumber, sequence }
  }
  apiURL: URL
  Agent             = ScrtAgent
  static Agent      = ScrtAgent
  static APIClient  = PatchedSigningCosmWasmClient_1_2
  static getDevnet  = getScrt_1_2_Devnet
  static chains = {
    async Mainnet (options = { url: config.scrt.mainnetApiUrl }) {
      return new Scrt_1_2(config.scrt.mainnetChainId, {
        mode:            Chain.Mode.Mainnet,
        apiURL:          new URL(options.url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Testnet (options = { url: config.scrt.testnetApiUrl }) {
      return new Scrt_1_2(config.scrt.testnetChainId, {
        mode:            ChainMode.Testnet,
        apiURL:          new URL(options.url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Devnet (options: any = {}) {
      const {
        node = await Scrt_1_2.getDevnet().respawn()
      } = options
      return new Scrt_1_2(node.chainId, {
        node,
        mode: ChainMode.Devnet,
        defaultIdentity: { name: 'ADMIN' },
      })
    }
  }
}

Object.assign(Chain.namedChains, {
  'Scrt_1_2_Mainnet': Scrt_1_2.chains.Mainnet,
  'Scrt_1_2_Testnet': Scrt_1_2.chains.Testnet,
  'Scrt_1_2_Devnet':  Scrt_1_2.chains.Devnet,
})
