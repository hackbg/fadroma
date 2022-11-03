import { EnvConfig } from '@hackbg/konfizi'

/** Environment settings for Secret Network API
  * that are common between gRPC and Amino implementations. */
export class ScrtConfig extends EnvConfig {

  static defaultMainnetChainId: string = 'secret-4'

  static defaultTestnetChainId: string = 'pulsar-2'

  static defaultMainnetUrl:     string = 'https://secret-4.api.trivium.network:9091'

  static defaultTestnetUrl:     string = 'https://grpc.testnet.secretsaturn.net'

  agentName:      string|null
    = this.getString('SCRT_AGENT_NAME',       ()=>null)

  agentAddress:   string|null
    = this.getString('SCRT_AGENT_ADDRESS',    ()=>null)

  agentMnemonic:  string|null
    = this.getString('SCRT_AGENT_MNEMONIC',   ()=>null)

  mainnetChainId: string
    = this.getString('SCRT_MAINNET_CHAIN_ID', ()=>ScrtConfig.defaultMainnetChainId)

  testnetChainId: string
    = this.getString('SCRT_TESTNET_CHAIN_ID', ()=>ScrtConfig.defaultTestnetChainId)

}
