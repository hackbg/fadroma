import type { Address, ChainId } from '@fadroma/client'
import { CustomConsole, CustomError } from '@hackbg/konzola'

export class ScrtError extends CustomError {
  static UseAmino = this.define('UseAmino',
    () => 'Use @fadroma/scrt-amino for the legacy API')
  static NoWalletOrMnemonic = this.define('NoWalletOrMnemonic',
    () => 'This Agent can only be created from mnemonic or wallet+address')
  static WrongChain = this.define('WrongChain',
    () => 'Tried to instantiate a contract that is uploaded to another chain')
  static NoWallet = this.define('NoWallet',
    () => 'Missing wallet')
  static NoApi = this.define('NoApi',
    () => 'Missing API interface object')
  static NoApiUrl = this.define('NoApiUrl',
    () => 'Missing gRPC API URL')
  static NoCodeId = this.define('NoCodeId',
    () => 'Need code ID to instantiate contract')
  static NoCodeHash = this.define('NoCodeHash',
    () => 'Missing code hash')
}

export class ScrtConsole extends CustomConsole {
  name = '@fadroma/scrt'
  warnIgnoringKeyPair = () =>
    this.warn('ScrtGrpcAgent: Ignoring keyPair (only supported by ScrtAminoAgent)')
  warnIgnoringMnemonic = () =>
    this.warn('ScrtGrpcAgent: Created from wallet, ignoring mnemonic')
  warnNoMemos = () =>
    this.warn("ScrtGrpcAgent: Transaction memos are not supported in SecretJS RPC API")
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
    this.log(`Run the following command to sign the bundle:\n`)
    this.log(`secretcli tx sign /dev/stdin --output-document=${output} \\
--offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${multisig} \\
--chain-id=${chainId} --account-number=${accountNumber} --sequence=${sequence} \\
<<< ${txdata}\n`)
    this.log(`Bundle contents as JSON:\n`)
    this.log(txdata)
    this.br()
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
