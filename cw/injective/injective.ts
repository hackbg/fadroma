import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'
export class InjectiveConnection extends CWConnection {}
export class InjectiveMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 60, bech32Prefix: 'inj', hdAccountIndex: 0, }
