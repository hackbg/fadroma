import type { Address, ChainId, Fee } from '@fadroma/agent'
import { Console, Error, bold } from '@fadroma/agent'

export default class ScrtConsole extends Console {

  label = '@fadroma/scrt'

  warnIgnoringMnemonic = () =>
    this.warn('Created from wallet, ignoring mnemonic')

  warnNoMemos = () =>
    this.warn("Transaction memos are not supported.")

  warnCouldNotFetchBlockLimit = (fees: Fee[]) =>
    this.warn("Could not fetch block gas limit, defaulting to:",
      fees.map(fee=>fee.gas).join('/'))

  warnGeneratedMnemonic = (mnemonic: string) => {
    this.warn("No mnemonic passed, generated this one:", bold(mnemonic))
    this.warn("To specify a default mnemonic, set the FADROMA_MNEMONIC environment variable.")
  }

  bundleMessages = (msgs: any, N: number) => {
    this.info(`\nMessages in bundle`, `#${N}:`)
    this.log(JSON.stringify(msgs, null, 2))
  }

  bundleMessagesEncrypted = (msgs: any, N: number) => {
    this.info(`\nEncrypted messages in bundle`, `#${N}:`)
    this.log(JSON.stringify(msgs, null, 2))
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
    this.log(`  secretcli tx sign /dev/stdin --output-document=${output} \\
--offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${multisig} \\
--chain-id=${chainId} --account-number=${accountNumber} --sequence=${sequence} \\
<<< ${txdata}\n`)

    this.log(`Bundle contents as JSON:\n`)
    this.log(' ', txdata)
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
