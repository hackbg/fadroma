import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

/** Update `process.env` with value from `.env` file */
dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

export class FadromaConfig {
  /** Project settings. */
  project = {
    /** The project's root directory. */
    root:         getEnvString('FADROMA_PROJECT', ()=>process.cwd()),
    /** The selected chain backend. */
    chain:        getEnvString('FADROMA_CHAIN',   ()=>undefined),
  }
  /** System settings. */
  system = {
    /** The user's home directory. */
    homeDir:      getEnvString('HOME',        ()=>homedir()),
    /** Address of Docker socket to use. */
    dockerHost:   getEnvString('DOCKER_HOST', ()=>'/var/run/docker.sock'),
  }
  /** Build settings. */
  build = {
    /** URL to the build manager endpoint, if used. */
    manager:      getEnvString('FADROMA_BUILD_MANAGER',   ()=>null),
    /** Whether to bypass Docker and use the toolchain from the environment. */
    raw:          getEnvBool(  'FADROMA_BUILD_RAW',       ()=>null),
    /** Whether to ignore existing build artifacts and rebuild contracts. */
    rebuild:      getEnvBool(  'FADROMA_REBUILD',         ()=>false),
  }
  /** Devnet settings. */
  devnet = {
    /** URL to the devnet manager endpoint, if used. */
    manager:      getEnvString('FADROMA_DEVNET_MANAGER',    ()=>null),
    /** Whether to remove the devnet after the command ends. */
    ephemeral:    getEnvBool(  'FADROMA_DEVNET_EPHEMERAL',  ()=>false),
    /** Chain id for devnet .*/
    chainId:      getEnvString('FADROMA_DEVNET_CHAIN_ID',   ()=>"fadroma-devnet"),
    /** Port for devnet. */
    port:         getEnvString('FADROMA_DEVNET_PORT',       ()=>null),
  }
  /** Upload settings. */
  upload = {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload:     getEnvBool(  'FADROMA_REUPLOAD', ()=>false),
  }
  /** DataHub API settings. */
  datahub = {
    /** API key for Figment DataHub APIs. */
    key:          getEnvString('FADROMA_DATAHUB_KEY',         ()=>null),
    /** Whether to apply DataHub rate limits */
    rateLimit:    getEnvBool(  'FADROMA_DATAHUB_RATE_LIMIT', ()=>false)
  }
  /** Secret Network settings. */
  scrt = {
    agent: {
      name:       getEnvString('SCRT_AGENT_NAME',       ()=>null),
      address:    getEnvString('SCRT_AGENT_ADDRESS',    ()=>null),
      mnemonic:   getEnvString('SCRT_AGENT_MNEMONIC',   ()=>null),
    },
    build: {
      dockerfile: getEnvString('SCRT_BUILD_DOCKERFILE', ()=>resolve(__dirname, 'packages/ops-scrt/build.Dockerfile')),
      image:      getEnvString('SCRT_BUILD_IMAGE',      ()=>'hackbg/fadroma-scrt-builder:1.2'),
      script:     getEnvString('SCRT_BUILD_SCRIPT',     ()=>resolve(__dirname, 'packages/ops-scrt/build-impl.mjs')),
      service:    getEnvString('SCRT_BUILD_SERVICE',    ()=>resolve(__dirname, 'packages/ops-scrt/build-server.mjs')),
    },
    mainnet: {
      chainId:    getEnvString('SCRT_MAINNET_CHAIN_ID', ()=>'secret-4'),
      apiUrl:     getEnvString('SCRT_MAINNET_API_URL',  ()=>null),
    },
    testnet: {
      chainId:    getEnvString('SCRT_TESTNET_CHAIN_ID', ()=>'pulsar-2'),
      apiUrl:     getEnvString('SCRT_TESTNET_API_URL',  ()=>null),
    }
  }

  constructor () {
    if (this.project.chain.startsWith('LegacyScrt')) {
      if (this.scrt.mainnet.apiUrl === null) {
        this.scrt.mainnet.apiUrl =
          `https://${this.scrt.mainnet.chainId}--lcd--full.datahub.figment.io`+
          `/apikey/${this.datahub.key}/`
      }
      if (this.scrt.testnet.apiUrl === null) {
        this.scrt.testnet.apiUrl =
          `https://${this.scrt.testnet.chainId}--lcd--full.datahub.figment.io`+
          `/apikey/${this.datahub.key}/`
      }
    } else if (this.project.chain.startsWith('Scrt')) {
      if (this.scrt.mainnet.apiUrl === null) {
        this.scrt.mainnet.apiUrl = 'https://secret-4.api.trivium.network:9091'
      }
      if (this.scrt.testnet.apiUrl === null) {
        this.scrt.testnet.apiUrl = 'https://testnet-web-rpc.roninventures.io'
      }
    }
  }
}

export default new FadromaConfig()

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
