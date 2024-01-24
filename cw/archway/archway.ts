import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'
export class ArchwayConnection extends CWConnection {}
export class ArchwayMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'archway', hdAccountIndex: 0, }
