import { resolve, homedir, dirname, fileURLToPath } from '@hackbg/toolbox'

export interface EnvVars {

  /** The user's home directory. */
  HOME: string
  /** Docker host */
  DOCKER_HOST: string

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

}

export class Config {

  fromEnv (env: EnvVars = process.env as any) {

    this.homeDir =
      env.HOME || homedir()
    this.chain =
      env.FADROMA_CHAIN || 'unspecified'
    this.dockerHost =
      env.DOCKER_HOST || '/var/run/docker.sock'
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

  }

  chain:                 string
  dockerHost:            string
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

}

export const config = new Config()
