import { URL } from 'url'
import { SigningCosmWasmClient } from 'secretjs'

import { Chain } from '@fadroma/ops'
import { Console, ChainMode, config } from '@fadroma/scrt'

import { ScrtAgent } from './ScrtAgent'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'
import { getScrtDevnet } from './ScrtDevnet'
import { getScrtBuilder } from './ScrtBuild'

const console = Console('@fadroma/scrt')

export const {
  // remotenet options
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
} = process.env

export type ScrtNonce = { accountNumber: number, sequence: number }

export abstract class Scrt extends Chain {
  async getNonce (address: string): Promise<ScrtNonce> {
    const sign = () => {throw new Error('unreachable')}
    const client = new SigningCosmWasmClient(this.url, address, sign)
    const { accountNumber, sequence } = await client.getNonce()
    return { accountNumber, sequence }
  }
}

export class Scrt_1_2 extends Scrt {
  faucet = `https://faucet.secrettestnet.io/`
  async getAgent (identity = config.scrt.defaultIdentity) {
    const agent = await super.getAgent(identity)
    agent.chain = this
    return agent
  }
  Agent             = Scrt_1_2.Agent
  static Agent      = ScrtAgent
  static APIClient  = PatchedSigningCosmWasmClient_1_2
  static getDevnet  = getScrtDevnet
  static getBuilder = getScrtBuilder
  static chains = {
    async Mainnet (url = config.scrt.mainnetApiUrl) {
      return new Scrt_1_2(config.scrt.mainnetChainId, {
        mode:   ChainMode.Mainnet,
        apiURL: new URL(url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Testnet (url = config.scrt.testnetApiUrl) {
      return new Scrt_1_2(config.scrt.testnetChainId, {
        mode:   ChainMode.Testnet,
        apiURL: new URL(url),
        defaultIdentity: config.scrt.defaultIdentity,
      })
    },
    async Devnet () {
      const node = await Scrt_1_2.getDevnet().respawn()
      return new Scrt_1_2(node.chainId, {
        node,
        mode:   ChainMode.Devnet,
        apiURL: new URL('http://localhost:1337'),
        defaultIdentity: 'ADMIN',
      })
    }
  }
}
