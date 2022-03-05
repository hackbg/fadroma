import { Console, colors, bold, timestamp, fromBase64, fromUtf8 } from '@fadroma/ops'

const console = Console('@fadroma/scrt/ScrtBundle')

import pako from 'pako'
import { SigningCosmWasmClient } from 'secretjs'

import {
  Agent, Bundle, BundleResult,
  Artifact, Template, Label, InitMsg, Instance,
  readFile, writeFile,
  toBase64
} from '@fadroma/ops'

import { ScrtGas } from './ScrtCore'
import type { Scrt, ScrtNonce } from './ScrtChain'
import type { ScrtAgent } from './ScrtAgent'
import type { ScrtAgentJS } from './ScrtAgentJS'

export abstract class ScrtBundle extends Bundle {

  static bundleCounter = 0

  get chain (): Scrt { return super.chain }

  constructor (readonly agent: ScrtAgent) { super(agent as Agent) }

  /** TODO: Upload is currently not supported from bundles
    * because it runs into the max request body size limit
    * quite easily, and I can't even find where that is defined
    * so I can implement chunking. */
  upload ({ location }: Artifact) {
    throw new Error('[@fadroma/scrt/ScrtBundle] upload not supported')
    return this
    //this.add(readFile(location).then(wasm=>({
      //type: 'wasm/MsgStoreCode',
      //value: {
        //sender:         this.address,
        //wasm_byte_code: toBase64(pako.gzip(wasm, { level: 9 }))
      //}
    //})))
    //return this
  }

  async instantiate (template: Template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  async instantiateMany (
    contracts: [Template, Label, InitMsg][],
    prefix?:   string,
    suffix?:   string
  ): Promise<Instance[]> {
    const instances = []
    for (const [template, name, initMsg] of contracts) {
      // generate the label here since `get label () {}` is no more
      let label = `${name}${suffix||''}`
      if (prefix) label = `${prefix}/${label}`
      console.info(bold('Instantiate:'), label)
      // add the init tx to the bundle. when passing a single contract
      // to instantiate, this should behave equivalently to non-bundled init
      instances.push(await this.instantiate(template, label, initMsg))
    }
    return instances
  }

  abstract init ({ codeId, codeHash }: Template, label, msg, init_funds): this

  protected get nonce (): Promise<ScrtNonce> {
    return this.chain.getNonce(this.agent.address)
  }

  /** Queries are disallowed in the middle of a bundle because
    * they introduce dependencies on external state */
  query = (...args) => {
    throw new Error("@fadroma/scrt/Bundle: can't query from a bundle")
  }

  protected async encrypt (codeHash, msg) {
    return (this.agent as unknown as ScrtAgentJS).encrypt(codeHash, msg)
  }

}

/** This implementation submits the messages collected in the bundle
  * as a single transaction.
  *
  * This formats the messages for API v1 like secretjs. */
export class BroadcastingScrtBundle extends ScrtBundle {

  constructor (readonly agent: ScrtAgentJS) {
    super(agent as unknown as ScrtAgent)
  }

  init ({ codeId, codeHash }: Template, label, msg, init_funds = []) {
    const sender  = this.address
    const code_id = String(codeId)
    this.add(this.encrypt(codeHash, msg).then(init_msg=>({
      type: 'wasm/MsgInstantiateContract',
      value: { sender, code_id, init_msg, label, init_funds }
    })))
    return this
  }

  execute ({ address, codeHash }: Instance, msg, sent_funds = []) {
    const sender   = this.address
    const contract = address
    console.info(bold('Adding message to bundle:'))
    console.log()
    console.log(JSON.stringify(msg))
    console.log()
    this.add(this.encrypt(codeHash, msg).then(msg=>({
      type: 'wasm/MsgExecuteContract',
      value: { sender, contract, msg, sent_funds }
    })))
    return this
  }

  async submit (memo = ""): Promise<BundleResult[]> {

    const N = this.agent.trace.call(
      `${bold(colors.yellow('MULTI'.padStart(5)))} ${this.msgs.length} messages`,
    )

    const msgs = await Promise.all(this.msgs)

    if (msgs.length < 1) {
      throw new Error('Trying to submit bundle with no messages')
    }

    for (const msg of msgs) {
      this.agent.trace.subCall(N, `${bold(colors.yellow(msg.type))}`)
    }

    const gas = new ScrtGas(msgs.length*1000000)
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
      console.error('Submitting bundle failed:', err.message)
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

/** This implementation generates a multisig-ready unsigned transaction bundle.
  * It does not execute it, but it saves it in `receipts/$CHAIN_ID/transactions`
  * and outputs a signing command for it to the console.
  *
  * This formats the messages for API v1beta1 like secretcli. */
export class MultisigScrtBundle extends ScrtBundle {

  init ({ codeId, codeHash }: Template, label, msg, init_funds = []) {
    const sender  = this.address
    const code_id = String(codeId)
    console.debug({
      "@type": "/secret.compute.v1beta1.MsgInstantiateContract",
      sender,
      callback_code_hash: "",
      code_id,
      label,
      init_msg: msg,
      init_funds,
      callback_sig: null
    })
    this.add(this.encrypt(codeHash, msg).then(init_msg=>({
      "@type": "/secret.compute.v1beta1.MsgInstantiateContract",
      sender,
      callback_code_hash: "",
      code_id,
      label,
      init_msg,
      init_funds,
      callback_sig: null
    })))
    return this
  }

  execute ({ address, codeHash }: Instance, msg, sent_funds = []) {
    const sender   = this.address
    const contract = address
    console.info(bold('Adding message to bundle:'))
    console.log()
    console.log(JSON.stringify(msg))
    console.log()
    console.debug({
      "@type": '/secret.compute.v1beta1.MsgExecuteContract',
      sender,
      contract,
      msg,
      callback_code_hash: "",
      sent_funds,
      callback_sig: null
    })
    this.add(this.encrypt(codeHash, msg).then(msg=>({
      "@type": '/secret.compute.v1beta1.MsgExecuteContract',
      sender,
      contract,
      msg,
      callback_code_hash: "",
      sent_funds,
      callback_sig: null
    })))
    return this
  }

  async submit (name: string): Promise<BundleResult[]> {

    // number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter

    name = name || `TX.${N}.${timestamp()}`

    // get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.nonce

    // the base Bundle class stores messages
    // as (immediately resolved) promises
    const msgs = await Promise.all(this.msgs)

    // print the body of the bundle
    console.info(bold(`Encrypted messages in bundle`), `#${N}:`)
    console.log()
    console.log(JSON.stringify(msgs))
    console.log()

    const finalUnsignedTx ={
      body: {
        messages: msgs,
        memo: name,
        timeout_height: "0",
        extension_options: [],
        non_critical_extension_options: []
      },
      auth_info: {
        signer_infos: [],
        fee: {...new ScrtGas(10000000), payer: "", granter: ""},
      },
      signatures: []
    }
    ;(finalUnsignedTx.auth_info.fee as any).gas_limit = finalUnsignedTx.auth_info.fee.gas
    delete finalUnsignedTx.auth_info.fee.gas

    this.saveBundle({ N, name }, { accountNumber, sequence }, finalUnsignedTx)

    return []

  }

  private async saveBundle ({ N, name }, { accountNumber, sequence }, bundle) {
    const unsignedFilename = `${name}.unsigned.json`
    const signedFilename = `${name}.signed.${timestamp()}.json`
    const output = this.chain.transactions.resolve(unsignedFilename)
    await writeFile(output, JSON.stringify(bundle, null, 2))
    console.log()
    console.info(bold(`Wrote bundle ${N} to:`), output)
    console.log()
    console.info(bold(`Sign bundle ${N} with this command:`))
    console.log()
    const {address, chain:{id}} = this
    console.log(`
  secretcli tx sign ${unsignedFilename} --offline \\
                    --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE \\
                    --multisig=${address} \\
                    --chain-id=${id} --account-number=${accountNumber} --sequence=${sequence} \\
                    --output-document=${signedFilename}`)
    console.log()
    return []
  }

}

export function mergeAttrs (
  attrs: {key:string,value:string}[]
): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}
