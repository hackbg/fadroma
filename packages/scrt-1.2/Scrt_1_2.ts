import { URL } from 'url'
import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, TextFile,
  Identity, Agent, ScrtAgentJS, ScrtAgentTX,
  Scrt, ChainMode,
  DockerodeBuilder, ManagedBuilder,
  DockerodeDevnet, ManagedDevnet,
} from '@fadroma/scrt'
import { ScrtAgentJS_1_2 } from './ScrtAgentJS_1_2'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'

const console = Console('@fadroma/scrt-1.2')

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const {
  // build options
  FADROMA_BUILD_MANAGER,
  FADROMA_BUILD_ALWAYS = false,
  SCRT_BUILD_IMAGE       = 'hackbg/fadroma-scrt-builder:1.2',
  SCRT_BUILD_DOCKERFILE  = resolve(__dirname, 'Scrt_1_2_Build.Dockerfile'),
  SCRT_BUILD_SCRIPT      = resolve(__dirname, 'Scrt_1_2_Build.sh'),
  // devnet options
  FADROMA_DEVNET_MANAGER,
  SCRT_DEVNET_CHAIN_ID_PREFIX = 'dev-scrt',
  // remotenet options
  DATAHUB_KEY,
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`,
  // agent options
  FADROMA_PREPARE_MULTISIG,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC,
} = process.env

export default class Scrt_1_2 extends Scrt {

  static Agent = FADROMA_PREPARE_MULTISIG ? ScrtAgentTX : ScrtAgentJS_1_2

  Agent = Scrt_1_2.Agent

  static APIClient = PatchedSigningCosmWasmClient_1_2

  static defaultIdentity = {
    name:     SCRT_AGENT_NAME,
    address:  SCRT_AGENT_ADDRESS,
    mnemonic: SCRT_AGENT_MNEMONIC
  }

  static chains = {

    async Mainnet (url = SCRT_MAINNET_API_URL) {
      return new Scrt_1_2(SCRT_MAINNET_CHAIN_ID, {
        mode:   ChainMode.Mainnet,
        apiURL: new URL(url),
        defaultIdentity: Scrt_1_2.defaultIdentity,
      })
    },

    async Testnet (url = SCRT_TESTNET_API_URL) {
      return new Scrt_1_2(SCRT_TESTNET_CHAIN_ID, {
        mode:   ChainMode.Testnet,
        apiURL: new URL(url),
        defaultIdentity: Scrt_1_2.defaultIdentity,
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

  static getDevnet = function getScrtDevnet_1_2 (
    chainId:    string = `${SCRT_DEVNET_CHAIN_ID_PREFIX}-${randomHex(4)}`,
    managerURL: string = FADROMA_DEVNET_MANAGER
  ) {
    if (managerURL) {
      return new ManagedDevnet({ managerURL, chainId })
    } else {
      const image       = "enigmampc/secret-network-sw-dev:v1.2.0"
      const readyPhrase = "indexed block"
      const initScript  = resolve(__dirname, 'Scrt_1_2_Node.sh')
      return new DockerodeDevnet({ image, readyPhrase, initScript })
    }
  }

  static getBuilder = function getScrtBuilder_1_2 ({
    managerURL = FADROMA_BUILD_MANAGER,
    caching    = !!FADROMA_BUILD_CACHE
  }: {
    managerURL?: string,
    caching?:    boolean
  } = {}) {
    if (managerURL) {
      return new ManagedBuilder({ managerURL, caching })
    } else {
      const image      = SCRT_BUILD_IMAGE
      const dockerfile = SCRT_BUILD_DOCKERFILE
      const script     = SCRT_BUILD_SCRIPT
      return new DockerodeBuilder({ image, dockerfile, script, caching })
    }
  }
}

export * from '@fadroma/scrt'
