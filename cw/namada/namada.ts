import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
class NamadaConnection extends CWConnection {}
class NamadaMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'tnam1', hdAccountIndex: 0, }
export {
  NamadaConnection       as Connection,
  NamadaMnemonicIdentity as MnemonicIdentity
}
