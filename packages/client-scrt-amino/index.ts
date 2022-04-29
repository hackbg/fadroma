import { Chain, Agent, AgentOptions, Gas, Fees, Template, Instance } from '@fadroma/client'
import { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
import { Bip39 } from '@cosmjs/crypto'
import {
  BroadcastMode,
  EnigmaUtils,
  Secp256k1Pen, encodeSecp256k1Pubkey, pubkeyToAddress, makeSignBytes,
  SigningCosmWasmClient
} from 'secretjs'
import { PatchedSigningCosmWasmClient_1_2 } from './patch'
import { Bundle, BundleResult } from './bundle'

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

interface SigningPen {
  pubkey: Uint8Array,
  sign:   Function
}

export interface LegacyScrtAgentOptions extends AgentOptions {
  keyPair?: { privkey: Uint8Array }
  pen?:     SigningPen
  fees?:    Fees
}

export class LegacyScrtAgent extends Agent {

  static async create (
    chain:   LegacyScrt,
    options: LegacyScrtAgentOptions
  ) {
    const { name = 'Anonymous', ...args } = options
    let   { mnemonic, keyPair } = options
    switch (true) {
      case !!mnemonic:
        // if keypair doesnt correspond to the mnemonic, delete the keypair
        if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
          console.warn(`ScrtAgent: Keypair doesn't match mnemonic, ignoring keypair`)
          keyPair = null
        }
        break
      case !!keyPair:
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = (Bip39.encode(keyPair.privkey) as any).data
        break
      default:
        // if there is neither, generate a new keypair and corresponding mnemonic
        keyPair  = EnigmaUtils.GenerateNewKeyPair()
        mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    return new LegacyScrtAgent(chain, {
      name,
      mnemonic,
      keyPair,
      pen: await Secp256k1Pen.fromMnemonic(mnemonic),
      ...args
    })
  }

  Bundle = LegacyScrtBundle
  fees   = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'

  constructor (
    public readonly chain: LegacyScrt,
    options: LegacyScrtAgentOptions = {}
  ) {
    super(chain, options)
    this.name     = options?.name || ''
    this.fees     = options?.fees || ScrtGas.defaultFees
    this.keyPair  = options?.keyPair
    this.mnemonic = options?.mnemonic
    this.pen      = options?.pen
    if (this.pen) {
      this.pubkey   = encodeSecp256k1Pubkey(options?.pen.pubkey)
      this.address  = pubkeyToAddress(this.pubkey, 'secret')
      this.sign     = this.pen.sign.bind(this.pen)
      this.seed     = EnigmaUtils.GenerateNewSeed()
    }
  }

  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      SigningPen
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  API = PatchedSigningCosmWasmClient_1_2
  get api () {
    return new this.API(
      this.chain?.url,
      this.address,
      this.sign,
      this.seed,
      this.fees,
      BroadcastMode.Sync
    )
  }
  get block () {
    return this.api.getBlock()
  }
  get account () {
    return this.api.getAccount(this.address)
  }
  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.api.sendTokens(recipient, [{denom, amount}], memo)
  }
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber: any
    let sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async getCodeHash (idOrAddr: number|string): Promise<string> {
    const { api } = this
    return this.rateLimited(async function getCodeHashInner () {
      if (typeof idOrAddr === 'number') {
        return await api.getCodeHashByCodeId(idOrAddr)
      } else if (typeof idOrAddr === 'string') {
        return await api.getCodeHashByContractAddr(idOrAddr)
      } else {
        throw new TypeError('getCodeHash id or addr')
      }
    })
  }
  async checkCodeHash (address: string, codeHash?: string) {
    // Soft code hash checking for now
    const realCodeHash = await this.getCodeHash(address)
    if (codeHash !== realCodeHash) {
      console.warn('Code hash mismatch for address:', address)
      console.warn('  Expected code hash:', codeHash)
      console.warn('  Code hash on chain:', realCodeHash)
    } else {
      console.info(`Code hash of ${address}:`, realCodeHash)
    }
  }
  async instantiate (template, label, msg, funds = []) {
    if (!template.codeHash) {
      throw new Error('@fadroma/scrt: Template must contain codeHash')
    }
    return super.instantiate(template, label, msg, funds)
  }
  async doInstantiate (template, label, msg, funds = []) {
    const { codeId, codeHash } = template
    const { api } = this
    const { logs, transactionHash } = await this.rateLimited(function doInstantiateInner () {
      return api.instantiate(Number(codeId), msg, label)
    })
    return {
      chainId:  this.chain.id,
      codeId:   Number(codeId),
      codeHash: codeHash,
      address:  logs[0].events[0].attributes[4].value,
      transactionHash,
    }
  }
  /** Instantiate multiple contracts from a bundled transaction. */
  async instantiateMany <InitMsg> (
    configs: [Template, string, InitMsg][],
    prefix?: string
  ): Promise<Record<string, Instance>> {
    // supermethod returns instances/receipts keyed by name
    const receipts = await super.instantiateMany(configs, prefix)
    // add code hashes to them:
    for (const i in configs) {
      const [template, label, initMsg] = configs[i]
      const receipt = receipts[label]
      if (receipt) {
        receipt.codeHash = template.codeHash
      }
    }
    return receipts
  }
  async getCodeId (address: string): Promise<number> {
    const { api } = this
    return this.rateLimited(async function getCodeIdInner () {
      const { codeId } = await api.getContract(address)
      return codeId
    })
  }
  async getLabel (address: string): Promise<string> {
    const { api } = this
    return this.rateLimited(async function getLabelInner () {
      const { label } = await api.getContract(address)
      return label
    })
  }
  async doQuery <T> (
    { address, codeHash }: Instance, msg: T
  ) {
    const { api } = this
    return this.rateLimited(function doQueryInner () {
      return api.queryContractSmart(address, msg as any, undefined, codeHash)
    })
  }
  async doExecute <T> (
    { address, codeHash }: Instance, msg: T,
    memo: any, amount: any, fee: any
  ) {
    return this.api.execute(address, msg as any, memo, amount, fee, codeHash)
  }
  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  async signTx (msgs, gas, memo) {
    const { accountNumber, sequence } = await this.api.getNonce()
    return await this.api.signAdapter(
      msgs,
      gas,
      this.chain.id,
      memo,
      accountNumber,
      sequence
    )
  }

  private initialWait = 1000

  private async rateLimited <T> (fn: ()=>Promise<T>): Promise<T> {
    //console.log('rateLimited', fn)
    let initialWait = 0
    if (this.chain.isMainnet && config.datahub.rateLimit) {
      const initialWait = this.initialWait*Math.random()
      console.warn(
        "Avoid running into rate limiting by waiting",
        Math.floor(initialWait), 'ms'
      )
      await new Promise(resolve=>setTimeout(resolve, initialWait))
      console.warn("Wait is over")
    }
    return backOff(fn, {
      jitter:        'full',
      startingDelay: 100 + initialWait,
      timeMultiple:  3,
      retry (error: Error, attempt: number) {
        if (error.message.includes('500')) {
          console.warn(`Error 500, retry #${attempt}...`)
          console.error(error.message)
          return true
        } else if (error.message.includes('429')) {
          console.warn(`Error 429, retry #${attempt}...`)
          console.error(error.message)
          return true
        } else {
          return false
        }
      }
    })
  }
}

export class LegacyScrt extends Chain {
  static Agent = LegacyScrtAgent
  Agent = LegacyScrt.Agent

  static Mainnet = class LegacyScrtMainnet extends LegacyScrt {
    mode = Chain.Mode.Mainnet
  }
  static Testnet = class LegacyScrtTestnet extends LegacyScrt {
    mode = Chain.Mode.Testnet
  }
  static Devnet  = class LegacyScrtTestnet extends LegacyScrt {
    mode = Chain.Mode.Devnet
  }
  static Mocknet = class LegacyScrtTestnet extends LegacyScrt {
    mode = Chain.Mode.Mocknet
  }

  async getNonce (address: string): Promise<ScrtNonce> {
    const sign = () => {throw new Error('unreachable')}
    const client = new SigningCosmWasmClient(this.url, address, sign)
    const { accountNumber, sequence } = await client.getNonce()
    return { accountNumber, sequence }
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
    return this.chain.getNonce(this.agent.address)
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

export class ScrtGas extends Gas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}
