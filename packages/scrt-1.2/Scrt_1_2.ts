import { URL } from 'url'
import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, TextFile,
  Identity, Agent, ScrtAgentJS, ScrtAgentTX,
  Scrt, ChainMode,
  DockerodeBuilder, ManagedBuilder,
  DockerodeDevnet, ManagedDevnet,
  config
} from '@fadroma/scrt'
import { ScrtAgentJS_1_2 } from './ScrtAgentJS_1_2'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'

const console = Console('@fadroma/scrt-1.2')

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const {
  // remotenet options
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahubKey}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahubKey}/`,
} = process.env

export default class Scrt_1_2 extends Scrt {

  static Agent = config.prepareMultisig ? ScrtAgentTX : ScrtAgentJS_1_2
  Agent = Scrt_1_2.Agent

  static APIClient = PatchedSigningCosmWasmClient_1_2

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

  static getDevnet = function getScrtDevnet_1_2 (
    chainId:    string = `${config.scrt.devnetChainIdPrefix}-${randomHex(4)}`,
    managerURL: string = config.devnetManager
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
    managerURL = config.buildManager,
    caching    = !config.buildAlways
  }: {
    managerURL?: string,
    caching?:    boolean
  } = {}) {
    if (managerURL) {
      return new ManagedBuilder({ managerURL, caching })
    } else {
      const image      = config.scrt.buildImage
      const dockerfile = config.scrt.buildDockerfile
      const script     = config.scrt.buildScript
      return new DockerodeBuilder({ image, dockerfile, script, caching })
    }
  }
}

export * from '@fadroma/scrt'
