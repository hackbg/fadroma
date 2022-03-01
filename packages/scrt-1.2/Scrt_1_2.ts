import { URL } from 'url'

import { Console, bold } from '@fadroma/ops'

import {
  dirname, fileURLToPath,
  ScrtDockerBuilder, resolve,
  Client,
  Scrt, ScrtAgentTX,
  Identity, Agent, ScrtAgentJS,
  DockerScrtNode, ChainNodeOptions, TextFile
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
  Agent = FADROMA_PREPARE_MULTISIG ? ScrtAgentTX : ScrtAgentJS_1_2
}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {

  API = PatchedSigningCosmWasmClient_1_2

  static create (options: Identity): Promise<Agent> {
    return ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)
  }

  async upload (pathToBinary: string) {
    const result = await super.upload(pathToBinary)
    // Non-blocking broadcast mode returns code ID = -1,
    // so we need to find the code ID manually from the output
    if (result.codeId === -1) {
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
        console.warn(`Could not get code ID for ${bold(pathToBinary)}: ${e.message}`)
        console.debug(`Result of upload transaction:`, result)
        throw e
      }
    }
    return result
  }

}

export class Scrt_1_2_Mainnet extends Scrt_1_2 {
  id         = 'secret-4'
  isMainnet  = true
  apiURL     = new URL(SCRT_API_URL||`https://secret-4--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`)
  defaultIdentity = {
    name:     SCRT_AGENT_NAME,
    address:  SCRT_AGENT_ADDRESS,
    mnemonic: SCRT_AGENT_MNEMONIC
  }
  constructor () {
    super()
    this.setDirs()
  }
}

export class Scrt_1_2_Testnet extends Scrt_1_2 {
  id         = 'pulsar-2'
  isTestnet  = true
  apiURL     = new URL(SCRT_API_URL||`https://secret-pulsar-2--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`)
  defaultIdentity = {
    name:     SCRT_AGENT_NAME,
    address:  SCRT_AGENT_ADDRESS,
    mnemonic: SCRT_AGENT_MNEMONIC
  }
  constructor () {
    super()
    this.setDirs()
  }
}

export class Scrt_1_2_Localnet extends Scrt_1_2 {
  id         = 'fadroma-scrt-12'
  node       = new DockerScrtNode_1_2()
  isLocalnet = true
  apiURL     = new URL('http://localhost:1337')
  defaultIdentity = 'ADMIN'
  constructor () {
    super()
    this.setNode()
    this.setDirs()
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

export default {
  SigningCosmWasmClient: PatchedSigningCosmWasmClient_1_2,
  Agent:    ScrtAgentJS_1_2,
  Builder:  ScrtDockerBuilder_1_2,
  Chains: {
    /** Create an instance that runs a node in a local Docker container
     *  and talks to it via SecretJS */
    'localnet-1.2': () => new Scrt_1_2_Localnet(),
    /** Create an instance that talks to to pulsar-1 testnet via SecretJS */
    'pulsar-2':     () => new Scrt_1_2_Testnet(),
    /** Create an instance that talks to to the Secret Network mainnet via secretcli */
    'secret-4':     () => new Scrt_1_2_Mainnet()
  },
  Node: DockerScrtNode_1_2,
}

export * from '@fadroma/scrt'
