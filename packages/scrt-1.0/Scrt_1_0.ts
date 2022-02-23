import { URL } from 'url'

import { Console, bold } from '@fadroma/ops'

import {
  dirname, fileURLToPath,
  ScrtDockerBuilder, resolve,
  ScrtContract,
  Scrt, ScrtAgentTX,
  Identity, Agent, ScrtAgentJS,
  DockerScrtNode, ChainNodeOptions, TextFile,
} from '@fadroma/scrt'

import { PatchedSigningCosmWasmClient_1_0 } from './Scrt_1_0_Patch'

const console = Console('@fadroma/scrt-1.0')

const {
  FADROMA_PREPARE_MULTISIG,
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC,
  DATAHUB_KEY
} = process.env

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const buildImage = 'hackbg/fadroma-scrt-builder:1.0'

export const buildDockerfile = resolve(__dirname, 'Scrt_1_0_Build.Dockerfile')

export class ScrtDockerBuilder_1_0 extends ScrtDockerBuilder {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
}

export abstract class ScrtContract_1_0<C extends Client> extends ScrtContract<C> {
  Builder = ScrtDockerBuilder_1_0
}

export class Scrt_1_0 extends Scrt {
  Agent = FADROMA_PREPARE_MULTISIG ? ScrtAgentTX : ScrtAgentJS_1_0
}

export class ScrtAgentJS_1_0 extends ScrtAgentJS {

  API = PatchedSigningCosmWasmClient_1_0

  static create (options: Identity): Promise<Agent> {
    return ScrtAgentJS.createSub(ScrtAgentJS_1_0 as unknown as AgentClass, options)
  }

}

export class Scrt_1_0_Mainnet extends Scrt_1_0 {
  id         = 'secret-2'
  isMainnet  = true
  apiURL     = new URL(`https://secret-2--lcd--full.datahub.figment.io/apikey/${DATAHUB_KEY}/`)
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

export class Scrt_1_0_Testnet extends Scrt_1_0 {
  id         = 'holodeck-2'
  isTestnet  = true
  apiURL     = new URL(SCRT_API_URL||'http://96.44.145.210/')
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

export class Scrt_1_0_Localnet extends Scrt_1_0 {
  id         = 'fadroma-scrt-10'
  isLocalnet = true
  node       = new DockerScrtNode_1_0()
  apiURL     = new URL('http://localhost:1337')
  defaultIdentity = 'ADMIN'
  constructor () {
    super()
    this.setNode()
    this.setDirs()
  }
}

export class DockerScrtNode_1_0 extends DockerScrtNode {
  readonly chainId: string = 'fadroma-scrt-10'
  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.0.4-5"
  readonly readyPhrase     = 'GENESIS COMPLETE'
  readonly initScript      = new TextFile(__dirname, 'Scrt_1_0_Init.sh')
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}

export default {
  SigningCosmWasmClient: PatchedSigningCosmWasmClient_1_0,
  Agent:    ScrtAgentJS_1_0,
  Builder:  ScrtDockerBuilder_1_0,
  Contract: ScrtContract_1_0,
  Chains: {
    /** Create an instance that runs a node in a local Docker container
     *  and talks to it via SecretJS */
    'localnet-1.0': () => new Scrt_1_0_Localnet(),
    /** Create an instance that talks to holodeck-2 testnet via SecretJS */
    'holodeck-2':   () => new Scrt_1_0_Testnet(),
    /** Create an instance that talks to to the Secret Network mainnet via secretcli */
    'secret-2':     () => new Scrt_1_0_Mainnet(),
  },
  Node: DockerScrtNode_1_0,
}

export * from '@fadroma/scrt'
