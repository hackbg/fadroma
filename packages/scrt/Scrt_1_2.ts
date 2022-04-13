import { URL } from 'url'

import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, relative, TextFile,
  Identity, Agent, ScrtAgent,
  Scrt, ChainMode,
  DockerodeBuilder, ManagedBuilder, RawBuilder,
  DockerodeDevnet, ManagedDevnet,
  config, DockerImage
} from '@fadroma/scrt'

import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'
import { getScrtDevnet } from './ScrtDevnet'
import { getScrtBuilder } from './ScrtBuild'

const console = Console('@fadroma/scrt')

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const {
  // remotenet options
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
} = process.env

export default class Scrt_1_2 extends Scrt {
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

export * from '@fadroma/scrt'
