import { Bundle } from '@fadroma/client'
import type { ScrtAgent } from './scrt-agent'
import { Scrt } from './scrt-chain'
import { ScrtConsole } from './scrt-events'

export interface ScrtBundleClass <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

/** Base class for transaction-bundling Agent for both Secret Network implementations. */
export abstract class ScrtBundle extends Bundle {

  static bundleCounter: number = 0

  log = new ScrtConsole('ScrtAgent')

  declare agent: ScrtAgent

  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction bundle; don't execute it, but save it in
    * `receipts/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    // Number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the bundle
    this.log.bundleMessages(this.msgs, N)
    // The base Bundle class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptInit(init)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the bundle
    this.log.bundleMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages)
    // Output signing instructions to the console
    this.log.bundleSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!, this.agent.assertChain().id,
      accountNumber, sequence, unsigned
    )
    return { N, name, accountNumber, sequence, unsignedTxBody: JSON.stringify(unsigned) }
  }

  private async encryptInit (init: any): Promise<any> {
    const encrypted = await this.agent.encrypt(init.codeHash, init.msg)
    return {
      "@type":            "/secret.compute.v1beta1.MsgInstantiateContract",
      callback_code_hash: '',
      callback_sig:       null,
      sender:             init.sender,
      code_id:     String(init.codeId),
      init_funds:         init.funds,
      label:              init.label,
      init_msg:           encrypted,
    }
  }

  private async encryptExec (exec: any): Promise<any> {
    const encrypted = await this.agent.encrypt(exec.codeHash, exec.msg)
    return {
      "@type":            '/secret.compute.v1beta1.MsgExecuteContract',
      callback_code_hash: '',
      callback_sig:       null,
      sender:             exec.sender,
      contract:           exec.contract,
      sent_funds:         exec.funds,
      msg:                encrypted,
    }
  }

  private composeUnsignedTx (encryptedMessages: any[]): any {
    const fee = Scrt.gas(10000000)
    const gas = fee.gas
    const payer = ""
    const granter = ""
    const auth_info = { signer_infos: [], fee: { ...fee, gas, payer, granter }, }
    const signatures: any[] = []
    const body = {
      messages:                       encryptedMessages,
      memo:                           name,
      timeout_height:                 "0",
      extension_options:              [],
      non_critical_extension_options: []
    }
    return { auth_info, signatures, body }
  }

}
