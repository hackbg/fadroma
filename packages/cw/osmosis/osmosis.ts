import { CLI } from '../cw-base'
import { CWBatch } from '../cw-batch'
import { CWConnection } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'

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
