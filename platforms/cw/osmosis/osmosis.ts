import { CLI } from '../CWBase'
import { CWConnection } from '../CWConnection'
import { CWMnemonicIdentity } from '../CWIdentity'

class OsmosisCLI extends CLI {}

class OsmosisConnection extends CWConnection {}

class OsmosisMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}

const defaults = { coinType: 118, bech32Prefix: 'osmo', hdAccountIndex: 0, }

export {
  OsmosisCLI              as CLI,
  OsmosisConnection       as Connection,
  OsmosisMnemonicIdentity as MnemonicIdentity
}
