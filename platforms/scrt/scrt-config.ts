import { EnvConfig } from '@hackbg/konfizi'

/** Environment settings for Secret Network API
  * that are common between gRPC and Amino implementations. */
export class ScrtConfig extends EnvConfig {
  static defaultMainnetChainId: string = 'secret-4'
  static defaultTestnetChainId: string = 'pulsar-2'

  scrtAgentName:      string|null
    = this.getString('SCRT_AGENT_NAME',       ()=>null)
  scrtAgentAddress:   string|null
    = this.getString('SCRT_AGENT_ADDRESS',    ()=>null)
  scrtAgentMnemonic:  string|null
    = this.getString('SCRT_AGENT_MNEMONIC',   ()=>null)
  scrtMainnetChainId: string
    = this.getString('SCRT_MAINNET_CHAIN_ID', ()=>ScrtConfig.defaultMainnetChainId)
  scrtTestnetChainId: string
    = this.getString('SCRT_TESTNET_CHAIN_ID', ()=>ScrtConfig.defaultTestnetChainId)
}
