import {
  Console, bold, colors,
  BundleResult,
  Agent,
  fromBase64, fromUtf8
} from '@fadroma/ops'
import { ScrtAgentJS } from './ScrtAgentJS'
import { ScrtBundle } from './ScrtBundle'
import { ScrtGas } from './ScrtCore'

const console = Console('@fadroma/scrt/SigningScrtBundle')

export class SigningScrtBundle extends ScrtBundle {

  constructor (readonly agent: ScrtAgentJS) { super(agent as Agent) }

  async submit (memo = ""): Promise<BundleResult[]> {

    const N = this.agent.trace.call(
      `${bold(colors.yellow('MULTI'.padStart(5)))} ${this.msgs.length} messages`,
    )

    const msgs = await Promise.all(this.msgs)
    for (const msg of msgs) {
      this.agent.trace.subCall(N, `${bold(colors.yellow(msg.type))}`)
    }

    const gas = new ScrtGas(msgs.length*5000000)
    const signedTx = await this.agent.signTx(msgs, gas, "")

    try {
      const txResult = await this.agent.api.postTx(signedTx)
      this.agent.trace.response(N, txResult.transactionHash)
      const results = []
      for (const i in msgs) {
        results[i] = {
          sender:  this.address,
          tx:      txResult.transactionHash,
          type:    msgs[i].type,
          chainId: this.chainId
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          const attrs = mergeAttrs(txResult.logs[i].events[0].attributes as any[])
          results[i].label   = msgs[i].value.label,
          results[i].address = attrs.contract_address
          results[i].codeId  = attrs.code_id
        }
        if (msgs[i].type === 'wasm/MsgExecuteContract') {
          results[i].address = msgs[i].contract
        }
      }
      return results
    } catch (err) {
      await this.handleError(err)
    }
  }

  private async handleError (err) {
    try {
      console.error(err.message)
      console.error('Trying to decrypt...')
      const errorMessageRgx = /failed to execute message; message index: (\d+): encrypted: (.+?): (?:instantiate|execute|query) contract failed/g;
      const rgxMatches = errorMessageRgx.exec(err.message);
      if (rgxMatches == null || rgxMatches.length != 3) {
          throw err;
      }
      const errorCipherB64 = rgxMatches[1];
      const errorCipherBz  = fromBase64(errorCipherB64);
      const msgIndex       = Number(rgxMatches[2]);
      const msg            = await this.msgs[msgIndex]
      const nonce          = fromBase64(msg.value.msg).slice(0, 32);
      const errorPlainBz   = await this.agent.api.restClient.enigmautils.decrypt(errorCipherBz, nonce);
      err.message = err.message.replace(errorCipherB64, fromUtf8(errorPlainBz));
    } catch (decryptionError) {
      console.error('Failed to decrypt :(')
      throw new Error(`Failed to decrypt the following error message: ${err.message}. Decryption error of the error message: ${decryptionError.message}`);
    }
    throw err
  }
}

export function mergeAttrs (
  attrs: {key:string,value:string}[]
): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}
