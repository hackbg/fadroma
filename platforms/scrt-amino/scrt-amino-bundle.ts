import { utf8, base64 }  from '@hackbg/formati'
import { Scrt, ScrtBundle } from '@fadroma/scrt'
import type { Address } from '@fadroma/scrt'
import type { ScrtAminoAgent } from './scrt-amino-agent'
import { PatchedSigningCosmWasmClient_1_2 as SigningCosmWasmClient } from './scrt-amino-patch'
import { mergeAttrs } from './merge-attrs'

/** Get the account number and current sequence number for an address. */
export async function getNonce (url: string, address: Address): Promise<ScrtNonce> {
  const client = new SigningCosmWasmClient(url, address, () => {throw new Error('unreachable')})
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export class ScrtAminoBundle extends ScrtBundle {

  declare agent: ScrtAminoAgent

  get nonce () {
    if (!this.agent || !this.agent.address) throw new Error("Missing address, can't get nonce")
    return getNonce(this.assertChain().url, this.agent.address)
  }

  async submit (memo = "") {
    const results: any[] = []
    /** Format the messages for API v1 like secretjs and encrypt them. */
    const init1 = (
      sender: Address, code_id: any, label: any, init_msg: any, init_funds: any
    ) => ({
      "type": 'wasm/MsgInstantiateContract',
      value: { sender, code_id, label, init_msg, init_funds }
    })
    const exec1 = (
      sender: Address, contract: Address, msg: any, sent_funds: any
    ) => ({
      "type": 'wasm/MsgExecuteContract',
      value: { sender, contract, msg, sent_funds }
    })
    const msgs = await Promise.all(this.assertMessages().map(({init, exec})=>{
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        const toMsg = (msg: unknown)=>init1(sender, String(codeId), label, msg, funds)
        return this.agent.encrypt(codeHash, msg).then(toMsg)
      }
      if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        const toMsg = (msg: unknown)=>exec1(sender, contract, msg, funds)
        return this.agent.encrypt(codeHash, msg).then(toMsg)
      }
      throw 'unreachable'
    }))
    const limit  = Number(Scrt.defaultFees.exec.amount[0].amount)
    const gas    = Scrt.gas(msgs.length*limit)
    const signed = await this.agent.signTx(msgs, gas, memo)
    try {
      const txResult = await this.agent.api.postTx(signed)
      for (const i in msgs) {
        const result: Record<string, unknown> = {
          sender:  this.address,
          tx:      txResult.transactionHash,
          type:    msgs[i].type,
          chainId: this.assertChain().id
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          type Attrs = { contract_address: Address, code_id: unknown }
          const attrs = mergeAttrs(txResult.logs[i].events[0].attributes) as Attrs
          //@ts-ignore
          result.label   = msgs[i].value.label
          result.address = attrs.contract_address
          result.codeId  = attrs.code_id
        }
        if (msgs[i].type === 'wasm/MsgExecuteContract') {
          //@ts-ignore
          result.address = msgs[i].contract
        }
        results[Number(i)] = result
      }
    } catch (e) {
      const err = e as Error
      const oldMessage = err.message
      try {
        console.error('Submitting bundle failed:', oldMessage)
        console.error('Trying to decrypt...')
        const errorMessageRgx = /failed to execute message; message index: (\d+): encrypted: (.+?): (?:instantiate|execute|query) contract failed/g;
        const rgxMatches = errorMessageRgx.exec(oldMessage);
        if (rgxMatches == null || rgxMatches.length != 3) throw err
        const errorCipherB64 = rgxMatches[1]
        const errorCipherBz  = base64.decode(errorCipherB64)
        const msgIndex       = Number(rgxMatches[2])
        const msg            = await this.msgs[msgIndex]
        const nonce          = base64.decode(msg.value.msg).slice(0, 32)
        const enigmaUtils    = this.agent.api.restClient.enigmautils
        const errorPlainBz   = await enigmaUtils.decrypt(errorCipherBz, nonce)
        const newMessage     = oldMessage.replace(errorCipherB64, utf8.decode(errorPlainBz))
        err.message = newMessage
      } catch (decryptionError) {
        const { message } = decryptionError as Error
        console.error('Failed to decrypt :(')
        throw new Error(
          `Failed to decrypt the following error message: ${oldMessage}. `+
          `Decryption error of the error message: ${message}`
        )
      }
      throw err
    }
    return results
  }

}
