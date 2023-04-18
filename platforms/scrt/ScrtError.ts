import { Error, bold } from '@fadroma/agent'

export default class ScrtError extends Error {
  static NoAddress = this.define('NoAddress',
    () => 'No address provided')
  static NoWalletOrMnemonic = this.define('NoWalletOrMnemonic',
    () => 'This Agent can only be created from mnemonic or wallet+address')
  static WrongChain = this.define('WrongChain',
    () => 'Tried to instantiate a contract that is uploaded to another chain')
  static NoWallet = this.define('NoWallet',
    () => 'Missing wallet')
  static NoApi = this.define('NoApi',
    () => 'Missing API interface object')
  static NoApiUrl = this.define('NoApiUrl',
    () => 'Missing API URL')
  static NoCodeId = this.define('NoCodeId',
    () => 'Need code ID to instantiate contract')
  static NoCodeHash = this.define('NoCodeHash',
    () => 'Missing code hash')
}
