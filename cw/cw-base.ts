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
