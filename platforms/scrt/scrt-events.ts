import type { Address, ChainId, Fee } from '@fadroma/core'
import { ClientConsole, ClientError, bold } from '@fadroma/core'

export class ScrtError extends ClientError {
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

export class ScrtConsole extends ClientConsole {
  name = '@fadroma/scrt'
  warnIgnoringKeyPair = () =>
    this.warn('ScrtGrpcAgent: Ignoring keyPair (only supported by ScrtAminoAgent)')
  warnIgnoringMnemonic = () =>
    this.warn('ScrtGrpcAgent: Created from wallet, ignoring mnemonic')
  warnNoMemos = () =>
    this.warn("ScrtGrpcAgent: Transaction memos are not supported in SecretJS RPC API")
  warnCouldNotFetchBlockLimit = (fees: Fee[]) =>
    this.warn("ScrtGrpc: Could not fetch block gas limit, defaulting to:",
      fees.map(fee=>fee.gas).join('/'))
  warnGeneratedMnemonic = (mnemonic: string) =>
    this.warn("ScrtGrpcAgent: No mnemonic passed, generated this one:", mnemonic)
  bundleMessages = (msgs: any, N: number) => {
    this.info(`\nMessages in bundle`, `#${N}:`)
    this.br()
    this.log(JSON.stringify(msgs, null, 2))
    this.br()
  }
  bundleMessagesEncrypted = (msgs: any, N: number) => {
    this.info(`\nEncrypted messages in bundle`, `#${N}:`)
    this.br()
    this.log(JSON.stringify(msgs, null, 2))
    this.br()
  }
  bundleSigningCommand = (
    name:            string,
    multisig:        Address,
    chainId:         ChainId,
    accountNumber:   number,
    sequence:        number,
    finalUnsignedTx: any
  ) => {
    const output = `${name}.signed.json`
    const txdata = shellescape([JSON.stringify(finalUnsignedTx)])
    this.br()
    this.log(`Run the following command to sign the bundle:\n`)
    this.log(`secretcli tx sign /dev/stdin --output-document=${output} \\
--offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${multisig} \\
--chain-id=${chainId} --account-number=${accountNumber} --sequence=${sequence} \\
<<< ${txdata}\n`)
    this.log(`Bundle contents as JSON:\n`)
    this.log(txdata)
    this.br()
  }
  submittingBundleFailed ({ message }: Error) {
    this.br()
    this.error('Submitting bundle failed:')
    this.error(bold(message))
    this.warn('Decrypting gRPC bundle errors is not implemented.')
  }
}

function shellescape(a: string[]) {
  const ret: string[] = [];
  a.forEach(function(s: string) {
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''")+"'";
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    ret.push(s);
  });
  return ret.join(' ');
}
