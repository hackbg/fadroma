import { ScrtConfig } from '@fadroma/scrt'

/** Amino-specific Secret Network settings. */
export class ScrtAminoConfig extends ScrtConfig {
  static defaultMainnetAminoUrl: string = 'n/a'
  static defaultTestnetAminoUrl: string = 'n/a'

  scrtMainnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAminoConfig.defaultMainnetAminoUrl)
  scrtTestnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAminoConfig.defaultTestnetAminoUrl)
}
