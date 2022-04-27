import { Chain } from '@fadroma/ops'
import { ScrtRPCAgent } from './Scrt_1.3_Agent'
import { getScrt_1_3_Devnet } from './Scrt_1.3_Devnet'
import { getScrt_1_3_Builder } from './Scrt_1.3_Build'
import { config } from './Scrt_1.3_Config'

export class Scrt_1_3 extends Chain {

  async getAgent (identity = config.scrt.defaultIdentity): Promise<ScrtRPCAgent> {
    return (await super.getAgent(identity)) as unknown as ScrtRPCAgent
  }

  Agent             = Scrt_1_3.Agent
  static Agent      = ScrtRPCAgent
  static getDevnet  = getScrt_1_3_Devnet
  static getBuilder = getScrt_1_3_Builder
  static faucet = `https://faucet.secrettestnet.io/`
  static chains = {
    async Mainnet (options = { url: config.scrt.mainnetApiUrl }) {
      return new Scrt_1_3(config.scrt.mainnetChainId, {
        mode:            Chain.Mode.Mainnet,
        apiURL:          new URL(options.url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Testnet (options = { url: config.scrt.testnetApiUrl }) {
      return new Scrt_1_3(config.scrt.testnetChainId, {
        mode:            Chain.Mode.Testnet,
        apiURL:          new URL(options.url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Devnet (options: any = {}) {
      const {
        node = await Scrt_1_3.getDevnet().respawn()
      } = options
      return new Scrt_1_3(node.chainId, {
        node,
        mode: Chain.Mode.Devnet,
        defaultIdentity: { name: 'ADMIN' },
      })
    }
  }
}
