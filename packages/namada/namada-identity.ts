import * as CW from '@fadroma/cw'

const defaults = {
  coinType:       118,
  bech32Prefix:   'tnam', 
  hdAccountIndex: 0,
}

export class NamadaMnemonicIdentity extends CW.MnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CW.MnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
