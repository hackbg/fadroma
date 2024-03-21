import { CLI } from '../cw-base'
import { CWConnection } from '../cw-connection'
import { CWBatch } from '../cw-batch'
import { CWMnemonicIdentity } from '../cw-identity'

class InjectiveCLI extends CLI {}

class InjectiveConnection extends CWConnection {}

class InjectiveMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}

const defaults = { coinType: 60, bech32Prefix: 'inj', hdAccountIndex: 0, }

export {
  InjectiveCLI              as CLI,
  InjectiveConnection       as Connection,
  InjectiveMnemonicIdentity as MnemonicIdentity,
}
