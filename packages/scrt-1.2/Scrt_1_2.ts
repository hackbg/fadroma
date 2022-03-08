import { URL } from 'url'
import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, TextFile,
  Identity,
  Scrt,
  ScrtDockerBuilder,
  Agent, ScrtAgentJS, ScrtAgentTX,
  ChainMode,
  DockerodeBuilder, ManagedBuilder,
  DockerodeDevnet, ManagedDevnet,
} from '@fadroma/scrt'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'

const console = Console('@fadroma/scrt-1.2')

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const {
  FADROMA_PREPARE_MULTISIG,
  FADROMA_BUILD_MANAGER,
  FADROMA_DEVNET_MANAGER,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC,
  DATAHUB_KEY,
  SCRT_MAINNET_CHAIN_ID       = 'secret-4',
  SCRT_MAINNET_API_URL        = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`,
  SCRT_TESTNET_CHAIN_ID       = 'pulsar-2',
  SCRT_TESTNET_API_URL        = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`,
  SCRT_DEVNET_CHAIN_ID_PREFIX = 'dev-scrt',
  SCRT_BUILD_IMAGE            = 'hackbg/fadroma-scrt-builder:1.2',
  SCRT_BUILD_DOCKERFILE       = resolve(__dirname, 'Scrt_1_2_Build.Dockerfile')
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
    chainId: string = `${SCRT_DEVNET_CHAIN_ID_PREFIX}-${randomHex(4)}`,
    manager: string = FADROMA_DEVNET_MANAGER
  ) {
    if (manager) {
      return new ManagedDevnet({ manager, chainId })
    } else {
      return new DockerodeDevnet({
        chainId,
        image:       "enigmampc/secret-network-sw-dev:v1.2.0",
        readyPhrase: 'indexed block',
        initScript:  new TextFile(__dirname, 'Scrt_1_2_Node.sh')
      })
    }
  }

  static getBuilder = function getScrtBuilder_1_2 (
    manager: string = FADROMA_BUILD_MANAGER
  ) {
    if (manager) {
      return new ManagedBuilder({ manager })
    } else {
      return new DockerodeBuilder({
        buildImage:      SCRT_BUILD_IMAGE
        buildDockerfile: SCRT_BUILD_DOCKERFILE
      })
    }
  }
}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {

  API = PatchedSigningCosmWasmClient_1_2

  static create (options: Identity): Promise<Agent> {
    return ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)
  }

  async upload (artifact) {
    const result = await super.upload(artifact)
    // Non-blocking broadcast mode returns code ID = -1,
    // so we need to find the code ID manually from the output
    if (result.codeId === "-1") {
      try {
        for (const log of (result as any).logs) {
          for (const event of log.events) {
            for (const attribute of event.attributes) {
              if (attribute.key === 'code_id') {
                Object.assign(result, { codeId: Number(attribute.value) })
                break
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Could not get code ID for ${bold(artifact.location)}: ${e.message}`)
        console.debug(`Result of upload transaction:`, result)
        throw e
      }
    }
    return result
  }

}

export * from '@fadroma/scrt'
