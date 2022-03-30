import { resolve, homedir, dirname, fileURLToPath } from '@hackbg/tools'
export const __dirname = dirname(fileURLToPath(import.meta.url))

export type EnvVars = {

  /** The user's home directory. */
  HOME: string

  /** URL to the build manager endpoint. */
  FADROMA_BUILD_MANAGER:           string
  /** Use toolchain from environment. */
  FADROMA_BUILD_RAW:               string
  /** Whether to mount the user's .ssh directory
    * into Dockerode-based build containers.
    * TODO: Allow a separate build key to be mounted
    *       to prevent the risk of leaking the user's SSH keys.  */
  FADROMA_BUILD_UNSAFE_MOUNT_KEYS: string
  /** Chain specifier. */
  FADROMA_CHAIN:                   string
  /** API key for Figment DataHub APIs. */
  FADROMA_DATAHUB_KEY:             string
  /** Whether to apply DataHub rate limits */
  FADROMA_DATAHUB_RATE_LIMIT:      string
  /** URL to the devnet manager endpoint. */
  FADROMA_DEVNET_MANAGER:          string
  /** Whether to remove the devnet after running. */
  FADROMA_DEVNET_EPHEMERAL:        string
  /** Whether the scripts are running in multisig mode. */
  FADROMA_PREPARE_MULTISIG:        string
  /** Which API calls, if any, to print in the console. */
  FADROMA_PRINT_TXS:               string
  /** The project's root directory. */
  FADROMA_PROJECT:                 string
  /** Whether to ignore existing build artifacts
    * and always rebuild contracts. */
  FADROMA_REBUILD:                 string
  /** Whether to ignore upload receipts
    * and always reupload contracts. */
  FADROMA_REUPLOAD:                string

  // Secret Network-specific options: //

  SCRT_AGENT_ADDRESS:          string
  SCRT_AGENT_MNEMONIC:         string
  SCRT_AGENT_NAME:             string

  SCRT_BUILD_DOCKERFILE:       string
  SCRT_BUILD_IMAGE:            string
  SCRT_BUILD_SCRIPT:           string

  SCRT_DEVNET_CHAIN_ID_PREFIX: string

  SCRT_MAINNET_API_URL:        string
  SCRT_MAINNET_CHAIN_ID:       string

  SCRT_TESTNET_API_URL:        string
  SCRT_TESTNET_CHAIN_ID:       string

}

export class Config {

  fromEnv (env: EnvVars = process.env as any) {

    this.homeDir =
      env.HOME || homedir()
    this.chain =
      env.FADROMA_CHAIN || 'unspecified'
    this.printTXs =
      env.FADROMA_PRINT_TXS || ''
    this.buildManager =
      env.FADROMA_BUILD_MANAGER || null
    this.buildRaw = Boolean(
      env.FADROMA_BUILD_RAW || false)
    this.buildUnsafeMountKeys = Boolean(
      env.FADROMA_BUILD_UNSAFE_MOUNT_KEYS || false)
    this.devnetManager =
      env.FADROMA_DEVNET_MANAGER || null
    this.devnetEphemeral = Boolean(
      env.FADROMA_DEVNET_EPHEMERAL || false)
    this.prepareMultisig = Boolean(
      env.FADROMA_PREPARE_MULTISIG || false)
    this.projectRoot =
      env.FADROMA_PROJECT || process.cwd()
    this.rebuild = Boolean(
      env.FADROMA_REBUILD || false)
    this.reupload = Boolean(
      env.FADROMA_REUPLOAD || false)

    this.datahub = {
      key:       env.FADROMA_DATAHUB_KEY,
      rateLimit: Boolean(env.FADROMA_DATAHUB_RATE_LIMIT || false)
    }

    this.scrt = {
      buildImage:
        env.SCRT_BUILD_IMAGE      || 'hackbg/fadroma-scrt-builder:1.2',
      buildDockerfile:
        env.SCRT_BUILD_DOCKERFILE || resolve(__dirname, '../scrt-1.2/Scrt_1_2_Build.Dockerfile'),
      buildScript:
        env.SCRT_BUILD_SCRIPT     || resolve(__dirname, '../scrt-1.2/Scrt_1_2_Build.sh'),

      mainnetChainId:
        env.SCRT_MAINNET_CHAIN_ID       || 'secret-4',
      testnetChainId:
        env.SCRT_TESTNET_CHAIN_ID       || 'pulsar-2',
      devnetChainIdPrefix:
        env.SCRT_DEVNET_CHAIN_ID_PREFIX || 'dev-scrt',

      mainnetApiUrl:
        '', // defined below
      testnetApiUrl:
        '', // defined below

      defaultIdentity: {
        name:     env.SCRT_AGENT_NAME,
        address:  env.SCRT_AGENT_ADDRESS,
        mnemonic: env.SCRT_AGENT_MNEMONIC
      }
    }

    this.scrt.mainnetApiUrl =
      env.SCRT_MAINNET_API_URL ||
        `https://${this.scrt.mainnetChainId}--lcd--full.datahub.figment.io`+
        `/apikey/${this.datahub.key}/`

    this.scrt.testnetApiUrl =
      env.SCRT_TESTNET_API_URL ||
        `https://secret-${this.scrt.testnetChainId}--lcd--full.datahub.figment.io`+
        `/apikey/${this.datahub.key}/`

  }

  chain:                 string
  homeDir:               string
  printTXs:              string
  buildRaw:              boolean
  buildManager:          string|null
  buildUnsafeMountKeys:  boolean
  devnetManager:         string|null
  devnetEphemeral:       boolean
  prepareMultisig:       boolean
  projectRoot:           string
  rebuild:               boolean
  reupload:              boolean

  datahub: {
    key:       string,
    rateLimit: boolean
  }

  scrt: {
    buildImage:          string
    buildDockerfile:     string
    buildScript:         string

    mainnetApiUrl:       string
    mainnetChainId:      string
    testnetApiUrl:       string
    testnetChainId:      string
    devnetChainIdPrefix: string

    defaultIdentity: {
      name:              string
      address:           string
      mnemonic:          string
    }
  }

}

export const config = new Config()
