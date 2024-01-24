import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'
export class AxelarConnection extends CWConnection {}
export class AxelarMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'axelar', hdAccountIndex: 0, }
