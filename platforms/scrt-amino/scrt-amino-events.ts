import { ScrtError, ScrtConsole } from '@fadroma/scrt'

export class ScrtAminoError extends ScrtError {
  static NoRecipients = this.define('NoRecipients',
    () => 'Tried to send to 0 recipients')
  static NoCodeHashInTemplate = this.define('NoCodeHashInTemplate',
    () => "Can't instantiate a template with no codeHash")
  static NoUploadBinary = this.define('NoUploadBinary',
    () => 'The upload method takes a Uint8Array')
  static NoApiUrl = this.define('NoApiUrl',
    () => 'ScrtAmino: no Amino API URL')
}

export class ScrtAminoConsole extends ScrtConsole {
  name = '@fadroma/scrt-amino'
  warnKeypair = () =>
    this.warn(`ScrtAgent: Keypair doesn't match mnemonic, ignoring keypair`)
}
