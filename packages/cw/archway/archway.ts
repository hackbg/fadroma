import { CLI } from '../cw-base'
import { CWConnection } from '../cw-connection'
import { CWBatch } from '../cw-batch'
import { CWMnemonicIdentity } from '../cw-identity'

class ArchwayCLI extends CLI {}

class ArchwayConnection extends CWConnection {}

class ArchwayMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}

const defaults = { coinType: 118, bech32Prefix: 'archway', hdAccountIndex: 0, }

export {
  ArchwayCLI              as CLI,
  ArchwayConnection       as Connection,
  ArchwayMnemonicIdentity as MnemonicIdentity,
}
