import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
class OsmosisConnection extends CWConnection {}
class OsmosisMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}
const defaults = { coinType: 118, bech32Prefix: 'osmo', hdAccountIndex: 0, }
export {
  OsmosisConnection       as Connection,
  OsmosisMnemonicIdentity as MnemonicIdentity
}
