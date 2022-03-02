import { URL } from 'url'
import { Console, bold, randomHex } from '@fadroma/ops'
import {
  dirname, fileURLToPath, resolve, TextFile,
  Identity, Artifact, Template,
  Scrt, DockerScrtNode, ChainNodeOptions,
  ScrtDockerBuilder,
  Agent, ScrtAgentJS, ScrtAgentTX,
  ChainMode
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
        for (const log of result.logs) {
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

export class DockerScrtNode_1_2 extends DockerScrtNode {
  readonly chainId: string = 'fadroma-scrt-12'
  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.2.0"
  readonly readyPhrase     = 'indexed block'
  readonly initScript      = new TextFile(__dirname, 'Scrt_1_2_Init.sh')
  constructor ({
    image,
    chainId,
    identities,
    stateRoot
  }: ChainNodeOptions = {}) {
    super()
    if (image)      this.image = image
    if (chainId)    this.chainId = chainId
    if (identities) this.identitiesToCreate = identities
    this.setDirectories(stateRoot)
  }
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

  SigningCosmWasmClient: PatchedSigningCosmWasmClient_1_2,

  Agent:   ScrtAgentJS_1_2,

  Builder: ScrtDockerBuilder_1_2,

  Node:    DockerScrtNode_1_2,

  Chains: {

    Mainnet () {
      return new Scrt_1_2(MAINNET_CHAIN_ID, {
        mode: ChainMode.Mainnet,
        defaultIdentity,
        apiURL: new URL(
          SCRT_API_URL||`https://secret-4--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`
        ),
      })
    },

    Testnet () {
      return new Scrt_1_2(TESTNET_CHAIN_ID, {
        mode: ChainMode.Testnet,
        defaultIdentity,
        apiURL: new URL(
          SCRT_API_URL||`https://secret-pulsar-2--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`
        ),
      })
    },

    Devnet () {
      const id = `${DEVNET_CHAIN_ID_PREFIX}-${randomHex(8)}`
      const node = new DockerScrtNode_1_2()
      return new Scrt_1_2(id, {
        mode: ChainMode.Devnet,
        defaultIdentity: 'ADMIN',
        apiURL: new URL('http://localhost:1337'),
        node,
      })
    },

  }

}

export * from '@fadroma/scrt'
