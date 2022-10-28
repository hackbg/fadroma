import { ScrtConfig } from '@fadroma/scrt'

/** Amino-specific Secret Network settings. */
export class ScrtAminoConfig extends ScrtConfig {
  scrtMainnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultMainnetAminoUrl)
  scrtTestnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultTestnetAminoUrl)
}

