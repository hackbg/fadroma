import { Console, colors, bold } from '@fadroma/ops'

const console = Console('@fadroma/scrt/Agent')

import {
  timestamp, 
  Agent, AgentConstructor, Bundle, BundleResult,
  Identity, Template, Label, InitMsg, Artifact, Instance, Message,
  readFile, backOff, fromBase64, toBase64, fromUtf8,
  config,
  readFile, writeFile,
  toBase64,
  config
} from '@fadroma/ops'

import { Bip39 } from '@cosmjs/crypto'

import {
  EnigmaUtils, Secp256k1Pen, encodeSecp256k1Pubkey,
  pubkeyToAddress, makeSignBytes, BroadcastMode,
  SigningCosmWasmClient,
} from 'secretjs'

import pako from 'pako'

import type { Scrt, ScrtNonce } from './ScrtChain'
import { ScrtGas } from './ScrtGas'

export abstract class ScrtAgent extends Agent {

  abstract Bundle: ScrtBundle

  /** Get the code hash for a code id or address */
  abstract getCodeHash (idOrAddr: number|string): Promise<string>

  abstract signTx (msgs, gas, memo?): Promise<any>

  /** Create a new v1.0 or v1.2 agent with its signing pen,
    * from a mnemonic or a keyPair.*/
  static async createSub (
    AgentClass: AgentConstructor,
    options:    Identity
  ): Promise<Agent> {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    let info = ''
    if (mnemonic) {
      info = bold(`Creating SecretJS agent from mnemonic:`) + ` ${name} `
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`ScrtAgentJS: Keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      info = `ScrtAgentJS: generating mnemonic from keypair for agent ${bold(name)}`
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      info = `ScrtAgentJS: creating new SecretJS agent: ${bold(name)}`
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    const pen  = await Secp256k1Pen.fromMnemonic(mnemonic)
    const agent = new AgentClass({name, mnemonic, keyPair, pen, ...args})
    return agent
  }

}

export type APIConstructor = new(...args:any) => SigningCosmWasmClient

export abstract class ScrtAgentJS extends ScrtAgent {

  fees = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'

  constructor (options: Identity & { API?: APIConstructor, chain?: Scrt } = {}) {
    super(options)

    this.name = this.trace.name = options?.name || ''

    this.chain    = options?.chain as Scrt // TODO chain id to chain
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

  readonly name:     string
  readonly chain:    Scrt
  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      any
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  readonly address:  string

  abstract readonly API: typeof SigningCosmWasmClient
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

  get nextBlock () { return waitUntilNextBlock(this) }

  get block     () { return this.api.getBlock() }

  get account   () { return this.api.getAccount(this.address) }

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

  async upload (artifact: Artifact): Promise<Template> {
    const data = await readFile(artifact.location)
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") {
      codeId = uploadResult.logs[0].events[0].attributes[3].value
    }
    const codeHash = uploadResult.originalChecksum
    if (codeHash !== artifact.codeHash) {
      console.warn(
        bold(`Code hash mismatch`),
        `when uploading`, artifact.location,
        `(expected: ${artifact.codeHash}, got: ${codeHash})`
      )
    }
    return { chainId: this.chain.id, codeId, codeHash }
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
      console.warn(bold('Code hash mismatch for address:'), address)
      console.warn(bold('  Expected code hash:'), codeHash)
      console.warn(bold('  Code hash on chain:'), realCodeHash)
    } else {
      console.info(bold(`Code hash of ${address}:`), realCodeHash)
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
  async instantiateMany (
    configs: [Template, Label, InitMsg][],
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
    //console.trace('getCodeId', address)
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

  async doQuery (
    { label, address, codeHash }: Instance, msg: Message
  ) {
    const { api } = this
    return this.rateLimited(function doQueryInner () {
      return api.queryContractSmart(address, msg as any, undefined, codeHash)
    })
  }

  async doExecute (
    { label, address, codeHash }: Instance, msg: Message,
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

export async function waitUntilNextBlock (
  agent:    ScrtAgent,
  interval: number = 1000
) {
  console.info(
    bold('Waiting until next block with'), agent.address
  )
  // starting height
  const {header:{height}} = await agent.block
  //console.info(bold('Block'), height)
  // every `interval` msec check if the height has increased
  return new Promise<void>(async resolve=>{
    while (true) {
      // wait for `interval` msec
      await new Promise(ok=>setTimeout(ok, interval))
      // get the current height
      const now = await agent.block
      //console.info(bold('Block'), now.header.height)
      // check if it went up
      if (now.header.height > height) {
        resolve()
        break
      }
    }
  })
}

/** This agent just collects unsigned txs and dumps them in the end
  * to be performed by manual multisig (via Motika). */
export class ScrtAgentTX extends ScrtAgent {

  get block   (): Promise<any> { throw new Error('not implemented') }
  get account (): Promise<any> { throw new Error('not implemented') }

  defaultDenomination = 'uscrt'

  doInstantiate (
    template: { chainId: string, codeId: string }, label: string, msg: any, funds: any[]
  ): Promise<any> { throw new Error('not needed') }

  doExecute (
    contract: { address: string, label: string },
    msg:   any,
    funds: any[],
    memo?: any,
    fee?:  any
  ): Promise<any> { throw new Error('not needed') }

  doQuery (
    contract: { address: string }, msg: any
  ): Promise<any> { throw new Error('not needed') }

  Bundle = MultisigScrtBundle

  signTx (msgs, gas, memo?): Promise<any> {
    throw new Error('not implemented')
  }

  constructor (readonly agent: ScrtAgentJS) {
    super({
      name:    `${agent.name}+Generate`,
      address: agent.address,
      chain:   agent.chain,
    })
  }

  upload (...args): Promise<any> {
    throw new Error('ScrtAgentTX#upload: not implemented')
  }

  instantiate (...args): Promise<any> {
    console.info('init', ...args)
    return
  }

  execute (contract, msg, ...args): Promise<any> {
    console.info(
      'execute',
      contract.name||contract.constructor.name,
      msg,
      args
    )
    return
  }

  query (
    contract: { address: string, label: string }, msg: any
  ) {
    console.info('query', contract.label, msg)
    return super.query(contract, msg)
  }

  get nextBlock () { return this.agent.nextBlock }

  async send () { throw new Error('not implemented') }

  async sendMany () { throw new Error('not implemented') }

  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.agent.api.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  getLabel (address) {
    return this.agent.getLabel(address)
  }

  getCodeId (address) {
    return this.agent.getCodeId(address)
  }

  getCodeHash (idOrAddr) {
    return this.agent.getCodeHash(idOrAddr)
  }

}

export class ScrtBundle extends Bundle {

  static bundleCounter = 0

  get chain (): Scrt { return super.chain }

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
    if (config.printTXs.includes('bundle')) {
      console.info(bold('Adding message to bundle:'))
      console.log()
      console.log(JSON.stringify(msg))
      console.log()
    }
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
    if (config.printTXs.includes('bundle')) {
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
    }
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
