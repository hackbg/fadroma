import {
  resolve, homedir, dirname, fileURLToPath,
  EnvVars, Config
} from '@fadroma/ops'

export interface ScrtEnvVars extends EnvVars {
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

export class ScrtConfig extends Config {
  fromEnv (env: ScrtEnvVars = process.env as any) {
    super.fromEnv(env)

    this.scrt = {
      buildImage:
        env.SCRT_BUILD_IMAGE      || 'hackbg/fadroma-scrt-builder:1.2',
      buildDockerfile:
        env.SCRT_BUILD_DOCKERFILE || resolve(__dirname, '../scrt/Scrt_1_2_Build.Dockerfile'),
      buildScript:
        env.SCRT_BUILD_SCRIPT     || resolve(__dirname, '../scrt/Scrt_1_2_Build.sh'),

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

    if (
      !this.scrt.defaultIdentity.name    &&
      !this.scrt.defaultIdentity.address &&
      !this.scrt.defaultIdentity.mnemonic
    ) {
      delete this.scrt.defaultIdentity
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

export const scrtConfig = new ScrtConfig()
