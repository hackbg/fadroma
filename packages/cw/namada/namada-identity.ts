import { CWMnemonicIdentity } from '../cw-identity'

const defaults = {
  coinType:       118,
  bech32Prefix:   'tnam', 
  hdAccountIndex: 0,
}

export class NamadaMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
