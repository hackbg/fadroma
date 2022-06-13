import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

dotenv.config()
const __dirname = dirname(fileURLToPath(import.meta.url))

function getEnvVar <T> (name: string, fallback: ()=>T): T {
  return (process.env[name] || fallback()) as T
}

const config = {
  /** The project's root directory. */
  project: {
    root:  String(getEnvVar('FADROMA_PROJECT', ()=>process.cwd())),
    /** Chain specifier. */
    chain: String(getEnvVar('FADROMA_CHAIN',   ()=>undefined)),
  },
  system: {
    /** The user's home directory. */
    homeDir:    String(getEnvVar('HOME',        ()=>homedir())),
    /** Docker host */
    dockerHost: String(getEnvVar('DOCKER_HOST', ()=>'/var/run/docker.sock')),
  },
  build: {
    /** URL to the build manager endpoint, if used. */
    manager: String(getEnvVar('FADROMA_BUILD_MANAGER', ()=>null)),
    /** Use toolchain from environment. */
    raw:     String(getEnvVar('FADROMA_BUILD_RAW',     ()=>false)),
    /** Whether to ignore existing build artifacts and rebuild contracts. */
    rebuild: Boolean(getEnvVar('FADROMA_REBUILD',      ()=>false)),
  },
  devnet: {
    /** URL to the devnet manager endpoint, if used. */
    manager:   String(getEnvVar('FADROMA_DEVNET_MANAGER',    ()=>null)),
    /** Whether to remove the devnet after the command ends. */
    ephemeral: Boolean(getEnvVar('FADROMA_DEVNET_EPHEMERAL', ()=>false)),
    /** Chain id for devnet .*/
    chainId:   String(getEnvVar('FADROMA_DEVNET_CHAIN_ID',   ()=>"fadroma-devnet")),
    /** Port for devnet. */
    port:      String(getEnvVar('FADROMA_DEVNET_PORT',       ()=>null)),
  },
  upload: {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload: Boolean(getEnvVar('FADROMA_REUPLOAD', ()=>false)),
  },
  /** DataHub API configuration. */
  datahub: {
    /** API key for Figment DataHub APIs. */
    key:       String(getEnvVar('FADROMA_DATAHUB_KEY',         ()=>null)),
    /** Whether to apply DataHub rate limits */
    rateLimit: Boolean(getEnvVar('FADROMA_DATAHUB_RATE_LIMIT', ()=>false))
  },
  /** Secret Network configuration. */
  scrt: {
    agent: {
      name:     String(getEnvVar('SCRT_AGENT_NAME',     ()=>null)),
      address:  String(getEnvVar('SCRT_AGENT_ADDRESS',  ()=>null)),
      mnemonic: String(getEnvVar('SCRT_AGENT_MNEMONIC', ()=>null)),
    },
    build: {
      dockerfile: String(getEnvVar('SCRT_BUILD_DOCKERFILE', ()=>resolve(__dirname, 'packages/ops-scrt/build.Dockerfile'))),
      image:      String(getEnvVar('SCRT_BUILD_IMAGE',      ()=>'hackbg/fadroma-scrt-builder:1.2')),
      script:     String(getEnvVar('SCRT_BUILD_SCRIPT',     ()=>resolve(__dirname, 'packages/ops-scrt/build-impl.mjs'))),
      service:    String(getEnvVar('SCRT_BUILD_SCRIPT',     ()=>resolve(__dirname, 'packages/ops-scrt/build-server.mjs'))),
    },
    mainnet: {
      chainId: String(getEnvVar('SCRT_MAINNET_CHAIN_ID', ()=>'secret-4')),
      apiUrl:  String(getEnvVar('SCRT_MAINNET_API_URL',  ()=>null)),
    },
    testnet: {
      chainId: String(getEnvVar('SCRT_TESTNET_CHAIN_ID', ()=>'pulsar-2')),
      apiUrl:  String(getEnvVar('SCRT_TESTNET_API_URL',  ()=>null)),
    }
  }
}

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

export default config
