import CLI from '@hackbg/cmds'
import { Core } from '@fadroma/agent'

export class CWError extends Core.Error {}

export class CWConsole extends Core.Console { label = '@fadroma/cw' }

export const {
  assign,
  bold, 
  Bip32,
  Bip39,
  Bip39EN,
  bech32,
  base64,
  RIPEMD160,
  SHA256,
  Secp256k1,
  numberToBytesBE
} = Core

class CWBaseCLI extends CLI {
  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }
}

export {
  CWBaseCLI as CLI
}
