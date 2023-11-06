/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error, Console } from './scrt-base'
import { Tx } from '@hackbg/secretjs-esm'
const {
  MsgStoreCode,
  MsgExecuteContract,
  MsgInstantiateContract
} = Tx
import type { Agent, Address, TxHash, ChainId, CodeId, CodeHash, Label } from '@fadroma/agent'
import { BatchBuilder } from '@fadroma/agent'
import Scrt from '.'

export class ScrtBatchBuilder extends BatchBuilder<Scrt> {
  /** Logger handle. */
  log = new Console('ScrtBatch')
  /** Messages to encrypt. */
  messages: Array<
    |InstanceType<typeof MsgStoreCode>
    |InstanceType<typeof MsgInstantiateContract>
    |InstanceType<typeof MsgExecuteContract>
  > = []
  /** TODO: Upload in batch. */
  upload (
    code:    Parameters<BatchBuilder<Scrt>["upload"]>[0],
    options: Parameters<BatchBuilder<Scrt>["upload"]>[1]
  ) {
    throw new Error('ScrtBatchBuilder#upload: not implemented')
    return this
  }

  instantiate (
    code:    Parameters<BatchBuilder<Scrt>["instantiate"]>[0],
    options: Parameters<BatchBuilder<Scrt>["instantiate"]>[1]
  ) {
    this.messages.push(new MsgInstantiateContract({
      //callback_code_hash: '',
      //callback_sig:       null,
      sender:     this.agent.address!,
      code_id:    ((typeof code === 'object') ? code.codeId : code) as CodeId,
      label:      options.label!,
      init_msg:   options.initMsg,
      init_funds: options.initSend,
    }))
    return this
  }

  execute (
    contract: Parameters<BatchBuilder<Scrt>["execute"]>[0],
    message:  Parameters<BatchBuilder<Scrt>["execute"]>[1],
    options:  Parameters<BatchBuilder<Scrt>["execute"]>[2],
  ) {
    if (typeof contract === 'object') contract = contract.address!
    this.messages.push(new MsgExecuteContract({
      //callback_code_hash: '',
      //callback_sig:       null,
      sender:           this.agent.address!,
      contract_address: contract,
      sent_funds:       options?.execSend,
      msg:              message as object,
    }))
    return this
  }

  private async encryptInit (init: any): Promise<any> {
    return {
      "@type":            "/secret.compute.v1beta1.MsgInstantiateContract",
      callback_code_hash: '',
      callback_sig:       null,
      sender:             this.agent.address,
      code_id:     String(init.codeId),
      init_funds:         init.funds,
      label:              init.label,
      init_msg:           await this.agent.encrypt(init.codeHash, init.msg),
    }
  }

  private async encryptExec (exec: any): Promise<any> {
    return {
      "@type":            '/secret.compute.v1beta1.MsgExecuteContract',
      callback_code_hash: '',
      callback_sig:       null,
      sender:             this.agent.address,
      contract:           exec.contract,
      sent_funds:         exec.funds,
      msg:                await this.agent.encrypt(exec.codeHash, exec.msg),
    }
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get encryptedMessages () {
    const messages: any[] = []
    return new Promise(async resolve=>{
      for (const message of this.messages) {
        switch (true) {
          case (message instanceof MsgStoreCode): {
            throw new Error('not implemented')
          }
          case (message instanceof MsgInstantiateContract): {
            messages.push(this.encryptInit(message))
            continue
          }
          case (message instanceof MsgExecuteContract): {
            messages.push(this.encryptExec(message))
            continue
          }
          default: {
            this.log.error(`Invalid batch message:`, message)
            throw new Error(`invalid batch message: ${message}`)
          }
        }
      }
      return messages
    })
  }

  async simulate () {
    return await this.agent.api.tx.simulate(this.messages)
  }

  async submit ({ memo = "" }: { memo: string }): Promise<ScrtBatchResult[]> {
    const chainId  = this.agent.chainId!
    const messages = this.messages
    const limit    = Number(this.agent.fees.exec?.amount[0].amount) || undefined
    const gas      = messages.length * (limit || 0)

    const results: ScrtBatchResult[] = []
    try {

      const txResult = await this.agent.api!.tx.broadcast(messages as any, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }

      for (const i in messages) {
        const msg = messages[i]
        const result: Partial<ScrtBatchResult> = {
          chainId, sender: this.agent.address, tx: txResult.transactionHash,
        }

        if (msg instanceof MsgInstantiateContract) {
          type Log = { msg: number, type: string, key: string }
          const findAddr = ({msg, type, key}: Log) =>
            msg  ==  Number(i) &&
            type === "message" &&
            key  === "contract_address"
          results[Number(i)] = Object.assign(result, {
            type:    'wasm/MsgInstantiateContract',
            codeId:  msg.codeId,
            label:   msg.label,
            address: txResult.arrayLog?.find(findAddr)?.value,
          }) as ScrtBatchResult
        } else if (msg instanceof MsgExecuteContract) {
          results[Number(i)] = Object.assign(result, {
            type:    'wasm/MsgExecuteContract',
            address: msg.contractAddress
          }) as ScrtBatchResult
        }
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
    name ??= name || `TX.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the batch
    this.log.batchMessages(this.messages, 0)
    // The base Batch class stores messages as (immediately resolved) promises
    const messages = await this.encryptedMessages
    // Print the body of the batch
    this.log.batchMessagesEncrypted(messages, 0)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages as any, name)
    // Output signing instructions to the console
    new Console(this.log.label).batchSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!,
      this.agent.chainId!,
      accountNumber,
      sequence,
      unsigned
    )
    return {
      name,
      accountNumber,
      sequence,
      unsignedTxBody: JSON.stringify(unsigned)
    }
  }

  private composeUnsignedTx (encryptedMessages: any[], memo?: string): any {
    const fee = Scrt.gas(10000000)
    return {
      auth_info: {
        signer_infos: [],
        fee: {
          ...fee,
          gas: fee.gas,
          payer: "",
          granter: ""
        },
      },
      signatures: [],
      body: {
        memo,
        messages: encryptedMessages,
        timeout_height: "0",
        extension_options: [],
        non_critical_extension_options: []
      }
    }
  }
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
