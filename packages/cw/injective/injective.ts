import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
class InjectiveConnection extends CWConnection {}
class InjectiveMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 60, bech32Prefix: 'inj', hdAccountIndex: 0, }
export {
  InjectiveConnection       as Connection,
  InjectiveMnemonicIdentity as MnemonicIdentity,
}
