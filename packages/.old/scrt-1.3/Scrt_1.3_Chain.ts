import { Scrt, getScrtBuilder, scrtConfig as config } from '@fadroma/scrt'
import { ScrtRPCAgent } from './Scrt_1.3_Agent'
import { getScrt_1_3_Devnet } from './Scrt_1.3_Devnet'

export class Scrt_1_3 extends Scrt {
  Agent             = ScrtRPCAgent
  static Agent      = ScrtRPCAgent
  static getDevnet  = getScrt_1_3_Devnet
  static getBuilder = getScrtBuilder
  static faucet = `https://faucet.secrettestnet.io/`
  static chains = {
    async Mainnet (options = { url: config.scrt.mainnetApiUrl }) {
      return new Scrt_1_3(config.scrt.mainnetChainId, {
        mode:            Scrt.Mode.Mainnet,
        apiURL:          new URL(options.url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Testnet (options = { url: config.scrt.testnetApiUrl }) {
      return new Scrt_1_3(config.scrt.testnetChainId, {
        mode:            Scrt.Mode.Testnet,
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
        mode: Scrt.Mode.Devnet,
        defaultIdentity: { name: 'ADMIN' },
      })
    }
  }
}
