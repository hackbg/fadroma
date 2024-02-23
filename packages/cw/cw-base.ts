import CLI from '@hackbg/cmds'
import { Core } from '@fadroma/agent'
export class CWError extends Core.Error {}
export class CWConsole extends Core.Console { label = '@fadroma/cw' }
export const {
  assign,
  bold, 
  bip32,
  bip39,
  bip39EN,
  bech32,
  base64,
} = Core

class CWBaseCLI extends CLI {
  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }
}
export { CWBaseCLI as CLI }
