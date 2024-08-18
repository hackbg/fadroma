import { CLI } from '../CWBase'
import { CWConnection } from '../CWConnection'
import { CWMnemonicIdentity } from '../CWIdentity'

class AxelarCLI extends CLI {}

class AxelarConnection extends CWConnection {}

class AxelarMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}

const defaults = { coinType: 118, bech32Prefix: 'axelar', hdAccountIndex: 0, }

export {
  AxelarCLI              as CLI,
  AxelarConnection       as Connection,
  AxelarMnemonicIdentity as MnemonicIdentity
}

