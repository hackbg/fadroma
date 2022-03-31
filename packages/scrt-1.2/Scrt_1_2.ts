import { URL } from 'url'
import {
  Console, bold, randomHex,
  dirname, fileURLToPath, resolve, relative, TextFile,
  Identity, Agent, ScrtAgentJS, ScrtAgentTX,
  Scrt, ChainMode,
  DockerodeBuilder, ManagedBuilder, RawBuilder,
  DockerodeDevnet, ManagedDevnet,
  config, DockerImage
} from '@fadroma/scrt'
import { ScrtAgentJS_1_2 } from './ScrtAgentJS_1_2'
import { PatchedSigningCosmWasmClient_1_2 } from './Scrt_1_2_Patch'

const console = Console('@fadroma/scrt-1.2')

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const {
  // remotenet options
  SCRT_MAINNET_CHAIN_ID = 'secret-4',
  SCRT_MAINNET_API_URL  = `https://${SCRT_MAINNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
  SCRT_TESTNET_CHAIN_ID = 'pulsar-2',
  SCRT_TESTNET_API_URL  = `https://secret-${SCRT_TESTNET_CHAIN_ID}--lcd--full.datahub.figment.io/apikey/${config.datahub.key}/`,
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
    managerURL: string = config.devnetManager,
    chainId?:   string,
  ) {
    if (managerURL) {
      return ManagedDevnet.getOrCreate(
        managerURL, chainId, config.scrt.devnetChainIdPrefix
      )
    } else {
      return new DockerodeDevnet({
        image: new DockerImage(
          undefined,
          "enigmampc/secret-network-sw-dev:v1.2.0",
        ),
        readyPhrase: "indexed block",
        initScript:  resolve(__dirname, 'Scrt_1_2_Node.sh')
      })
    }
  }

  static getBuilder = function getScrtBuilder_1_2 ({
    raw        = config.buildRaw,
    managerURL = config.buildManager,
    caching    = !config.rebuild
  }: {
    raw?:        boolean,
    managerURL?: string,
    caching?:    boolean
  } = {}) {
    if (raw) {
      return new RawBuilder(
        resolve(dirname(config.scrt.buildScript), 'Scrt_1_2_BuildCommand.sh'),
        resolve(dirname(config.scrt.buildScript), 'Scrt_1_2_BuildCheckout.sh')
      )
    } else if (managerURL) {
      return new ManagedBuilder({ managerURL })
    } else {
      return new DockerodeBuilder_Scrt_1_2({ caching })
    }
  }
}

export class DockerodeBuilder_Scrt_1_2 extends DockerodeBuilder {

  buildManager = "Scrt_1_2_Build.js"

  buildEntryPoint = relative(
    dirname(config.scrt.buildDockerfile),
    config.scrt.buildScript
  )

  buildHelpers = [ "Scrt_1_2_BuildCheckout.sh", "Scrt_1_2_BuildCommand.sh" ]

  image = new DockerImage(
    undefined,
    config.scrt.buildImage,
    config.scrt.buildDockerfile,
    [
      this.buildEntryPoint,
      this.buildManager,
      ...this.buildHelpers
    ]
  )

  constructor ({ caching }) {
    super({
      script: config.scrt.buildScript,
      caching
    })
  }

  protected getBuildContainerArgs (source, output): [string, any] {
    const [cmd, args] = super.getBuildContainerArgs(source, output)
    for (const helper of this.buildHelpers) {
      args.HostConfig.Binds.push(
        `${resolve(dirname(config.scrt.buildScript), helper)}:/${helper}:ro`
      )
    }
    return [cmd, args]
  }
}

export * from '@fadroma/scrt'
