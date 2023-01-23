import { Bundle, assertChain } from '@fadroma/core'
import type { Address, TxHash, ChainId, CodeId, CodeHash, Label } from '@fadroma/core'
import type { ScrtAgent } from './scrt-agent'
import { Scrt } from './scrt-chain'
import { ScrtError as Error, ScrtConsole as Console } from './scrt-events'

export interface ScrtBundleClass <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

export interface ScrtBundleResult {
  sender?:   Address
  tx:        TxHash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}

/** Base class for transaction-bundling Agent for both Secret Network implementations. */
export class ScrtBundle extends Bundle {

  static bundleCounter: number = 0

  log = new Console('ScrtAgent')

  /** The agent which will sign and/or broadcast the bundle. */
  declare agent: ScrtAgent

  constructor (agent: ScrtAgent) {
    super(agent)
    // Optional: override SecretJS implementation
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

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
      this.agent.address!, assertChain(this.agent).id,
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

  async submit (memo = ""): Promise<ScrtBundleResult[]> {
    const SecretJS = (this.agent?.chain as Scrt).SecretJS
    const chainId = assertChain(this).id
    const results: ScrtBundleResult[] = []
    const msgs  = await this.conformedMsgs
    const limit = Number(Scrt.defaultFees.exec?.amount[0].amount) || undefined
    const gas   = msgs.length * (limit || 0)
    try {
      const agent = this.agent as unknown as ScrtAgent
      const txResult = await agent.api.tx.broadcast(msgs, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in bundle): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBundleResult> = {}
        result.sender  = this.address
        result.tx      = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof SecretJS.MsgInstantiateContract) {
          type Log = { msg: number, type: string, key: string }
          const findAddr = ({msg, type, key}: Log) =>
            msg  ==  Number(i) &&
            type === "message" &&
            key  === "contract_address"
          result.type    = 'wasm/MsgInstantiateContract'
          result.codeId  = msg.codeId
          result.label   = msg.label
          result.address = txResult.arrayLog?.find(findAddr)?.value
        }
        if (msg instanceof SecretJS.MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBundleResult
      }
    } catch (err) {
      this.log.submittingBundleFailed(err)
      throw err
    }
    return results
  }

  async simulate () {
    const { api } = this.agent as ScrtAgent
    return await api.tx.simulate(await this.conformedMsgs)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    return Promise.all(this.assertMessages().map(async ({init, exec})=>{
      const SecretJS = (this.agent.chain as Scrt).SecretJS
      if (init) return new SecretJS.MsgInstantiateContract({
        sender:          init.sender,
        code_id:         init.codeId,
        code_hash:       init.codeHash,
        label:           init.label,
        init_msg:        init.msg,
        init_funds:      init.funds,
      })
      if (exec) return new SecretJS.MsgExecuteContract({
        sender:           exec.sender,
        contract_address: exec.contract,
        code_hash:        exec.codeHash,
        msg:              exec.msg,
        sent_funds:       exec.funds,
      })
      throw 'unreachable'
    }))
  }

}
