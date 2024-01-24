import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'
export class OsmosisConnection extends CWConnection {}
export class OsmosisMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'osmo', hdAccountIndex: 0, }
