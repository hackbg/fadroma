import { URL } from 'url'
import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, TextFile,
  Identity, Artifact, Template,
  Scrt, DockerodeScrtDevnet, ManagedScrtDevnet,
  ScrtDockerBuilder,
  Agent, ScrtAgentJS, ScrtAgentTX,
  ChainMode,
  DockerodeDevnet, ManagedDevnet,
} from '@fadroma/scrt'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'

const console = Console('@fadroma/scrt-1.2')

const {
  FADROMA_PREPARE_MULTISIG,
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC,
  DATAHUB_KEY
} = process.env

export const __dirname = dirname(fileURLToPath(import.meta.url))
export const buildImage = 'hackbg/fadroma-scrt-builder:1.2'
export const buildDockerfile = resolve(__dirname, 'Scrt_1_2_Build.Dockerfile')
export class ScrtDockerBuilder_1_2 extends ScrtDockerBuilder {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  static enable = () => ({ builder: new this() })
}

export class Scrt_1_2 extends Scrt {
  Agent = FADROMA_PREPARE_MULTISIG
    ? ScrtAgentTX
    : ScrtAgentJS_1_2
}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {
  API = PatchedSigningCosmWasmClient_1_2
  static create (options: Identity): Promise<Agent> {
    return ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)
  }
  async upload (artifact: Artifact): Promise<Template> {
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

export class DockerodeScrtDevnet_1_2 extends DockerodeScrtDevnet {
  image       = "enigmampc/secret-network-sw-dev:v1.2.0"
  readyPhrase = 'indexed block'
  initScript  = new TextFile(__dirname, 'Scrt_1_2_Node.sh')
  constructor (options) { super(options) }
}

export class ManagedScrtDevnet_1_2 extends ManagedScrtDevnet {
  constructor (options) { super(options) }
}

export const MAINNET_CHAIN_ID = 'secret-4'
export const TESTNET_CHAIN_ID = 'pulsar-2'
export const DEVNET_CHAIN_ID_PREFIX = 'dev-scrt'

const defaultIdentity = {
  name:     SCRT_AGENT_NAME,
  address:  SCRT_AGENT_ADDRESS,
  mnemonic: SCRT_AGENT_MNEMONIC
}

export default {
  APIClient: PatchedSigningCosmWasmClient_1_2,
  Agent:     ScrtAgentJS_1_2,
  Builder:   ScrtDockerBuilder_1_2,
  Devnet: {
    Dockerode: DockerodeScrtDevnet_1_2,
    Managed:   ManagedScrtDevnet_1_2
  },
  Chains: {
    async Mainnet () {
      return new Scrt_1_2(MAINNET_CHAIN_ID, {
        mode: ChainMode.Mainnet,
        defaultIdentity,
        apiURL: new URL(
          SCRT_API_URL||`https://secret-4--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`
        ),
      })
    },
    async Testnet () {
      return new Scrt_1_2(TESTNET_CHAIN_ID, {
        mode: ChainMode.Testnet,
        defaultIdentity,
        apiURL: new URL(
          SCRT_API_URL||`https://secret-pulsar-2--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`
        ),
      })
    },
    async Devnet (managed = !!process.env.FADROMA_DOCKERIZED) {
      const id = randomHex(4)
      const chainId = `${DEVNET_CHAIN_ID_PREFIX}.${id}`
      const node = managed
        ? new ManagedScrtDevnet_1_2({ chainId })
        : new DockerodeScrtDevnet_1_2({ chainId })
      await node.respawn()
      return new Scrt_1_2(chainId, {
        node,
        mode: ChainMode.Devnet,
        defaultIdentity: 'ADMIN',
        apiURL: new URL('http://localhost:1337'),
      })
    },
  }
}

export * from '@fadroma/scrt'
