import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

dotenv.config()
const __dirname = dirname(fileURLToPath(import.meta.url))

function getEnvString (name: string, fallback: ()=>string|null): string|null {
  if (process.env.hasOwnProperty(name)) {
    return String(process.env[name] as string)
  } else {
    return fallback()
  }
}

function getEnvBool (name: string, fallback: ()=>boolean|null): boolean|null {
  if (process.env.hasOwnProperty(name)) {
    return Boolean(process.env[name] as string)
  } else {
    return fallback()
  }
}

const config = {
  /** The project's root directory. */
  project: {
    root:  getEnvString('FADROMA_PROJECT', ()=>process.cwd()),
    /** Chain specifier. */
    chain: getEnvString('FADROMA_CHAIN',   ()=>undefined),
  },
  system: {
    /** The user's home directory. */
    homeDir:    getEnvString('HOME',        ()=>homedir()),
    /** Docker host */
    dockerHost: getEnvString('DOCKER_HOST', ()=>'/var/run/docker.sock'),
  },
  build: {
    /** URL to the build manager endpoint, if used. */
    manager: getEnvString('FADROMA_BUILD_MANAGER', ()=>null),
    /** Use toolchain from environment. */
    raw:     getEnvString('FADROMA_BUILD_RAW',     ()=>null),
    /** Whether to ignore existing build artifacts and rebuild contracts. */
    rebuild: getEnvBool('FADROMA_REBUILD',         ()=>false),
  },
  devnet: {
    /** URL to the devnet manager endpoint, if used. */
    manager:   getEnvString('FADROMA_DEVNET_MANAGER',    ()=>null),
    /** Whether to remove the devnet after the command ends. */
    ephemeral: getEnvBool('FADROMA_DEVNET_EPHEMERAL', ()=>false),
    /** Chain id for devnet .*/
    chainId:   getEnvString('FADROMA_DEVNET_CHAIN_ID',   ()=>"fadroma-devnet"),
    /** Port for devnet. */
    port:      getEnvString('FADROMA_DEVNET_PORT',       ()=>null),
  },
  upload: {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload: getEnvBool('FADROMA_REUPLOAD', ()=>false),
  },
  /** DataHub API configuration. */
  datahub: {
    /** API key for Figment DataHub APIs. */
    key:       getEnvString('FADROMA_DATAHUB_KEY',         ()=>null),
    /** Whether to apply DataHub rate limits */
    rateLimit: getEnvBool('FADROMA_DATAHUB_RATE_LIMIT', ()=>false)
  },
  /** Secret Network configuration. */
  scrt: {
    agent: {
      name:     getEnvString('SCRT_AGENT_NAME',     ()=>null),
      address:  getEnvString('SCRT_AGENT_ADDRESS',  ()=>null),
      mnemonic: getEnvString('SCRT_AGENT_MNEMONIC', ()=>null),
    },
    build: {
      dockerfile: getEnvString('SCRT_BUILD_DOCKERFILE', ()=>resolve(__dirname, 'packages/ops-scrt/build.Dockerfile')),
      image:      getEnvString('SCRT_BUILD_IMAGE',      ()=>'hackbg/fadroma-scrt-builder:1.2'),
      script:     getEnvString('SCRT_BUILD_SCRIPT',     ()=>resolve(__dirname, 'packages/ops-scrt/build-impl.mjs')),
      service:    getEnvString('SCRT_BUILD_SCRIPT',     ()=>resolve(__dirname, 'packages/ops-scrt/build-server.mjs')),
    },
    mainnet: {
      chainId: getEnvString('SCRT_MAINNET_CHAIN_ID', ()=>'secret-4'),
      apiUrl:  getEnvString('SCRT_MAINNET_API_URL',  ()=>null),
    },
    testnet: {
      chainId: getEnvString('SCRT_TESTNET_CHAIN_ID', ()=>'pulsar-2'),
      apiUrl:  getEnvString('SCRT_TESTNET_API_URL',  ()=>null),
    }
  }
}

if (config.project.chain.startsWith('LegacyScrt')) {
  if (config.scrt.mainnet.apiUrl === null) {
    config.scrt.mainnet.apiUrl =
      `https://${config.scrt.mainnet.chainId}--lcd--full.datahub.figment.io`+
      `/apikey/${config.datahub.key}/`
  }
  if (config.scrt.testnet.apiUrl === null) {
    config.scrt.testnet.apiUrl =
      `https://${config.scrt.testnet.chainId}--lcd--full.datahub.figment.io`+
      `/apikey/${config.datahub.key}/`
  }
} else if (config.project.chain.startsWith('Scrt')) {
  if (config.scrt.mainnet.apiUrl === null) {
    config.scrt.mainnet.apiUrl = 'https://secret-4.api.trivium.network:9091'
  }
  if (config.scrt.testnet.apiUrl === null) {
    config.scrt.testnet.apiUrl = 'https://testnet-web-rpc.roninventures.io'
  }
}

export default config
