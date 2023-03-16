import { EnvConfig } from '@hackbg/conf'

/** Environment settings for Secret Network. */
export default class ScrtConfig extends EnvConfig {

  static defaultMainnetChainId: string = 'secret-4'

  static defaultTestnetChainId: string = 'pulsar-2'

  static defaultMainnetUrl:     string = 'https://lcd.mainnet.secretsaturn.net'

  static defaultTestnetUrl:     string = 'https://lcd.testnet.secretsaturn.net'

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

  mainnetUrl: string
    = this.getString('SCRT_MAINNET_URL', ()=>ScrtConfig.defaultMainnetUrl)

  testnetUrl: string
    = this.getString('SCRT_TESTNET_URL', ()=>ScrtConfig.defaultTestnetUrl)

}
