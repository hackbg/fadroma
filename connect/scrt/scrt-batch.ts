/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error, Console } from './scrt-base'
import { MsgExecuteContract, MsgInstantiateContract } from '@hackbg/secretjs-esm'
import type { Agent, Address, TxHash, ChainId, CodeId, CodeHash, Label } from '@fadroma/agent'
import { BatchBuilder } from '@fadroma/agent'
import * as Scrt from './scrt-chain'

export interface ScrtBatchClass <B extends ScrtBatch> {
  new (agent: Scrt.Agent): B
}

export interface ScrtBatchResult {
  sender?:   Address
  tx:        TxHash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}

export class ScrtBatchBuilder extends BatchBuilder<Scrt.Agent> {

  /** Logger handle. */
  log = new Console('ScrtBatch')

  static batchCounter: number = 0

  upload (
    code:    Parameters<BatchBuilder<Agent>["upload"]>[0],
    options: Parameters<BatchBuilder<Agent>["upload"]>[1]
  ) {
    return this
  }

  instantiate (
    code:    Parameters<BatchBuilder<Agent>["instantiate"]>[0],
    options: Parameters<BatchBuilder<Agent>["instantiate"]>[1]
  ) {
    return this
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

  execute (
    contract: Parameters<BatchBuilder<Agent>["execute"]>[0],
    options:  Parameters<BatchBuilder<Agent>["execute"]>[1]
  ) {
    return this
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

  async submit ({ memo = "" }: { memo: string }): Promise<ScrtBatchResult[]> {
    const chainId = this.agent.chainId!
    const results: ScrtBatchResult[] = []
    const msgs  = this.conformedMsgs
    const limit = Number(this.agent.fees.exec?.amount[0].amount) || undefined
    const gas   = msgs.length * (limit || 0)
    try {
      const agent = this.agent
      const txResult = await agent.api!.tx.broadcast(msgs as any, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBatchResult> = {}
        result.sender = this.agent.address
        result.tx = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof MsgInstantiateContract) {
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
        if (msg instanceof MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBatchResult
      }
    } catch (err) {
      new Console(this.log.label).submittingBatchFailed(err as Error)
      throw err
    }
    return results
  }

  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction batch; don't execute it, but save it in
    * `state/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    // Number of batch, just for identification in console
    const N = ++ScrtBatch.batchCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the batch
    this.log.batchMessages(this.msgs, N)
    // The base Batch class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptExec(exec)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the batch
    this.log.batchMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages, name)
    // Output signing instructions to the console
    new Console(this.log.label).batchSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!,
      this.agent.chainId!,
      accountNumber,
      sequence,
      unsigned
    )
    return { N, name, accountNumber, sequence, unsignedTxBody: JSON.stringify(unsigned) }
  }

  private composeUnsignedTx (encryptedMessages: any[], memo?: string): any {
    const fee = Scrt.Chain.gas(10000000)
    const gas = fee.gas
    const payer = ""
    const granter = ""
    const auth_info = { signer_infos: [], fee: { ...fee, gas, payer, granter }, }
    const signatures: any[] = []
    const body = {
      memo,
      messages:                       encryptedMessages,
      timeout_height:                 "0",
      extension_options:              [],
      non_critical_extension_options: []
    }
    return { auth_info, signatures, body }
  }

  async simulateForGas () {
    const msgs = this.conformedMsgs
    return await this.agent.api.tx.simulate(msgs as any)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    const msgs = this.messages.map(({init, exec}={})=>{
      if (init) return new MsgInstantiateContract({
        sender:          init.sender,
        code_id:         init.codeId,
        code_hash:       init.codeHash,
        label:           init.label,
        init_msg:        init.msg,
        init_funds:      init.funds,
      })
      if (exec) return new MsgExecuteContract({
        sender:           exec.sender,
        contract_address: exec.contract,
        code_hash:        exec.codeHash,
        msg:              exec.msg,
        sent_funds:       exec.funds,
      })
    })
    return msgs
  }

}
