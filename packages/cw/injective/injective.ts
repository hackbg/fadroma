import { CLI } from '../CWBase'
import { CWConnection } from '../CWConnection'
import { CWMnemonicIdentity } from '../CWIdentity'

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
