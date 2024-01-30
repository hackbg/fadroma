import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
class ArchwayConnection extends CWConnection {}
class ArchwayMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'archway', hdAccountIndex: 0, }
export {
  ArchwayConnection       as Connection,
  ArchwayMnemonicIdentity as MnemonicIdentity,
}
