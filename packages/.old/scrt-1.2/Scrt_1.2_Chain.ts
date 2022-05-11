import { URL } from 'url'
import { SigningCosmWasmClient } from 'secretjs'
import { scrtConfig as config, Chain, Scrt, ScrtNonce, Console, ChainMode } from '@fadroma/scrt'

import { getScrt_1_2_Devnet } from './Scrt_1.2_Devnet'
import { ScrtAgent } from './Scrt_1.2_Agent'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1.2_Patch'

const console = Console('@fadroma/scrt')

export class Scrt_1_2 extends Scrt {

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
    async Devnet (options: { node?: Scrt_1_2_Devnet } = {}) {
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

  async getNonce (address: string): Promise<ScrtNonce> {
    const sign = () => {throw new Error('unreachable')}
    const client = new SigningCosmWasmClient(this.apiURL.toString(), address, sign)
    const { accountNumber, sequence } = await client.getNonce()
    return { accountNumber, sequence }
  }
}
