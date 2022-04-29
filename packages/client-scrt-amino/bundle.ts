import {
  Executor, Agent,
  Template, Instance,
  Client, ClientCtor, ClientOptions,
  ScrtGas
} from '@fadroma/client-scrt'

export type BundleWrapper = (bundle: Bundle) => Promise<any>

export interface BundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

export abstract class Bundle implements Executor {

  constructor (readonly agent: Agent) {}

  private depth = 0

  /** Opening a bundle from within a bundle
    * returns the same bundle with incremented depth. */
  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  /** Execute the bundle if not nested;
    * decrement the depth if nested. */
  run (memo: string): Promise<BundleResult[]|null> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      return null
    } else {
      return this.submit(memo)
    }
  }

  async wrap (cb: BundleWrapper) {
    await cb(this)
    return this.run("")
  }

  protected id: number = 0
  protected msgs: Array<any> = []

  /** Add a message to the bundle, incrementing
    * the bundle's internal message counter. */
  protected add (msg: any): number {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  abstract init <T> (
    template: Template,
    label:    string,
    msg:      T,
    send:     any[]
  ): Promise<this>

  abstract instantiateMany (
    configs: [Template, string, object][],
    prefix?: string,
    suffix?: string
  ): Promise<Record<string, Instance>>

  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    throw new Error("don't query inside bundle")
  }

  abstract execute <T, U> (instance: Instance, msg: T): Promise<U>

  abstract submit (memo: string): Promise<BundleResult[]>

  abstract save (name: string): Promise<void>

  getClient <C extends Client> (
    Client:  ClientCtor<C>,
    options: ClientOptions
  ): C {
    return new Client(this, options)
  }

  getCodeId (address) {
    return this.agent.getCodeId(address)
  }

  get chain (): Scrt {
    return this.agent.chain
  }

  get name () {
    return `${this.agent.name}@BUNDLE`
  }

  get address () {
    return this.agent.address
  }

  getLabel (address: string) {
    return this.agent.getLabel(address)
  }

  getHash (address) {
    return this.agent.getHash(address)
  }

  get balance () {
    throw new Error("don't query inside bundle")
    return Promise.resolve(0n)
  }

  async getBalance (denom) {
    throw new Error("can't get balance in bundle")
    return Promise.resolve(0n)
  }

  get defaultDenom () {
    return this.agent.defaultDenom
  }

}

export class LegacyScrtBundle extends Bundle {

  agent: LegacyScrtAgent

  msgs: Array<any> = []

  static bundleCounter = 0

  async instantiate (template: Template, label, msg, init_funds = []) {
    await this.init(template, label, msg, init_funds)
    const { codeId, codeHash } = template
    return { chainId: this.agent.chain.id, codeId, codeHash }
  }

  async instantiateMany (
    configs: [Template, string, object][],
    prefix?: string,
    suffix?: string
  ): Promise<Record<string, Instance>> {
    const instances = {}
    for (let [template, name, initMsg] of configs) {
      if (suffix) name = `${name}${suffix}`
      let label = name
      if (prefix) label = `${prefix}/${name}`
      console.info('Instantiate:', label)
      // add the init tx to the bundle. when passing a single contract
      // to instantiate, this should behave equivalently to non-bundled init
      instances[name] = await this.instantiate(template, label, initMsg)
    }
    return instances
  }

  async init ({ codeId, codeHash }: Template, label, msg, funds = []): Promise<this> {
    const sender  = this.address
    const code_id = String(codeId)
    this.add({init: { sender, codeId, codeHash, label, msg, funds }})
    return this
  }

  async execute ({ address, codeHash }: Instance, msg, funds = []): Promise<this> {
    const sender   = this.address
    const contract = address
    this.add({exec: { sender, contract, codeHash, msg, funds }})
    return this
  }

  protected get nonce (): Promise<ScrtNonce> {
    return getNonce(this.chain, this.agent.address)
  }

  /** Queries are disallowed in the middle of a bundle because
    * they introduce dependencies on external state */
  query = (...args) => {
    throw new Error("@fadroma/scrt/Bundle: can't query from a bundle")
  }

  protected async encrypt (codeHash, msg) {
    return this.agent.encrypt(codeHash, msg)
  }

  /** Format the messages for API v1 like secretjs,
    * encrypt them, and submit them as a single transaction. */
  async submit (memo = ""): Promise<BundleResult[]> {
    if (this.msgs.length < 1) {
      throw new Error('Trying to submit bundle with no messages')
    }

    const msgs = await Promise.all(this.msgs.map(({init, exec})=>{
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        return this.encrypt(codeHash, msg).then(msg=>init1(sender, String(codeId), label, msg, funds))
      }
      if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        return this.encrypt(codeHash, msg).then(msg=>exec1(sender, contract, msg, funds))
      }
      throw 'unreachable'
    }))

    const gas = new ScrtGas(msgs.length*1000000)
    const signedTx = await this.agent.signTx(msgs, gas, "")

    try {
      const txResult = await this.agent.api.postTx(signedTx)
      const results = []
      for (const i in msgs) {
        results[i] = {
          sender:  this.address,
          tx:      txResult.transactionHash,
          type:    msgs[i].type,
          chainId: this.chain.id
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          const attrs = mergeAttrs(txResult.logs[i].events[0].attributes as any[])
          results[i].label   = (msgs[i] as any).value.label,
          results[i].address = attrs.contract_address
          results[i].codeId  = attrs.code_id
        }
        if (msgs[i].type === 'wasm/MsgExecuteContract') {
          results[i].address = (msgs[i] as any).contract
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

  /** Format the messages for API v1beta1 like secretcli
    * and generate a multisig-ready unsigned transaction bundle;
    * don't execute it, but save it in `receipts/$CHAIN_ID/transactions`
    * and output a signing command for it to the console. */
  async save (name: string): Promise<void> {

    // number of bundle, just for identification in console
    const N = ++LegacyScrtBundle.bundleCounter

    name = name || `TX.${N}.${+new Date()}`

    // get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.nonce

    // the base Bundle class stores messages
    // as (immediately resolved) promises

    const msgs = await Promise.all(
      this.msgs.map(({init, exec})=>{
        if (init) {
          const { sender, codeId, codeHash, label, msg, funds } = init
          return this.encrypt(codeHash, msg).then(msg=>init2(sender, String(codeId), label, msg, funds))
        }
        if (exec) {
          const { sender, contract, codeHash, msg, funds } = exec
          return this.encrypt(codeHash, msg).then(msg=>exec2(sender, contract, msg, funds))
        }
        throw 'unreachable'
      }))

    // print the body of the bundle
    console.info(`Encrypted messages in bundle`, `#${N}:`)
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

    console.log(JSON.stringify(
      { N, name, accountNumber, sequence, unsignedTxBody: finalUnsignedTx },
      null, 2
    ))

  }

}

const init1 = (sender, code_id, label, init_msg, init_funds) => ({
  "type": 'wasm/MsgInstantiateContract',
  value: { sender, code_id, label, init_msg, init_funds }
})

const init2 = (sender, code_id, label, init_msg, init_funds) => ({
  "@type": "/secret.compute.v1beta1.MsgInstantiateContract",
  callback_code_hash: "", callback_sig: null,
  sender, code_id, label, init_msg, init_funds,
})

const exec1 = (sender, contract, msg, sent_funds) => ({
  "type": 'wasm/MsgExecuteContract',
  value: { sender, contract, msg, sent_funds }
})

const exec2 = (sender, contract, msg, sent_funds) => ({
  "@type": '/secret.compute.v1beta1.MsgExecuteContract',
  callback_code_hash: "", callback_sig: null,
  sender, contract, msg, sent_funds,
})

export function mergeAttrs (attrs: {key:string,value:string}[]): any {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

export async function getNonce (url, address): Promise<ScrtNonce> {
  const sign = () => {throw new Error('unreachable')}
  const client = new SigningCosmWasmClient(url, address, sign)
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}
