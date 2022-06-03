import { Bip39 } from '@cosmjs/crypto'
import {
  AgentOptions,
  CodeId,
  CodeHash,
  Instance,
  ScrtAgent,
  ScrtBundle,
  ScrtChain,
  ScrtGas,
} from '@fadroma/client-scrt'
import { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
import { backOff } from 'exponential-backoff'
import {
  BroadcastMode,
  EnigmaUtils,
  ExecuteResult,
  InstantiateResult,
  Secp256k1Pen,
  SigningCosmWasmClient,
  encodeSecp256k1Pubkey,
  makeSignBytes,
  pubkeyToAddress, 
} from 'secretjs'

import * as constants from './scrt-amino-const'
import { PatchedSigningCosmWasmClient_1_2 } from './scrt-amino-patch'

const privKeyToMnemonic = privKey => (Bip39.encode(privKey) as any).data

interface SigningPen {
  pubkey: Uint8Array,
  sign:   Function
}

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export interface LegacyScrtAgentOptions extends AgentOptions {
  keyPair?: { privkey: Uint8Array }
  pen?:     SigningPen
}

export class LegacyScrtAgent extends ScrtAgent {

  //@ts-ignore
  Bundle = LegacyScrtBundle

  static async create (chain, options) {
    const { name = 'Anonymous', ...args } = options
    let   { mnemonic, keyPair } = options
    switch (true) {
      case !!mnemonic:
        // if keypair doesnt correspond to the mnemonic, delete the keypair
        if (keyPair && mnemonic !== privKeyToMnemonic(keyPair.privkey)) {
          console.warn(`ScrtAgent: Keypair doesn't match mnemonic, ignoring keypair`)
          keyPair = null
        }
        break
      case !!keyPair:
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = privKeyToMnemonic(keyPair.privkey)
        break
      default:
        // if there is neither, generate a new keypair and corresponding mnemonic
        keyPair  = EnigmaUtils.GenerateNewKeyPair()
        mnemonic = privKeyToMnemonic(keyPair.privkey)
    }
    return new LegacyScrtAgent(chain, {
      name,
      mnemonic,
      keyPair,
      pen: await Secp256k1Pen.fromMnemonic(mnemonic),
      ...args
    })
  }

  constructor (chain, options: LegacyScrtAgentOptions = {}) {
    super(chain, options)
    this.name     = options?.name || ''
    // @ts-ignore
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

  readonly keyPair

  readonly mnemonic

  readonly pen: SigningPen

  readonly sign

  readonly pubkey

  readonly seed

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

  get height () {
    return this.block.then(block=>block.header.height)
  }

  get account () {
    return this.api.getAccount(this.address)
  }

  /** Get up-to-data balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenom) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }

  async send (recipient, amount, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.api.sendTokens(recipient, [{denom, amount}], memo)
  }

  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error(constants.ERR_ZERO_RECIPIENTS)
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber
    let sequence
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async getHash (idOrAddr: number|string) {
    const { api } = this
    return await this.rateLimited(async function getCodeHashInner () {
      if (typeof idOrAddr === 'number') {
        return await api.getCodeHashByCodeId(idOrAddr)
      } else if (typeof idOrAddr === 'string') {
        return await api.getCodeHashByContractAddr(idOrAddr)
      } else {
        throw new TypeError('getCodeHash id or addr')
      }
    }) as CodeHash
  }

  async checkCodeHash (address, codeHash) {
    // Soft code hash checking for now
    const realCodeHash = await this.getHash(address)
    if (codeHash !== realCodeHash) {
      console.warn('Code hash mismatch for address:', address)
      console.warn('  Expected code hash:', codeHash)
      console.warn('  Code hash on chain:', realCodeHash)
    } else {
      console.info(`Code hash of ${address}:`, realCodeHash)
    }
  }

  async upload (data) {
    if (!(data instanceof Uint8Array)) {
      throw new Error(constants.ERR_UPLOAD_BINARY)
    }
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") {
      codeId = uploadResult.logs[0].events[0].attributes[3].value
    }
    const codeHash = uploadResult.originalChecksum
    return {
      uploadTx: uploadResult.transactionHash,
      chainId:  this.chain.id,
      codeId,
      codeHash
    }
  }

  async instantiate (template, label, msg, funds = []) {
    if (!template.codeHash) {
      throw new Error(constants.ERR_TEMPLATE_NO_CODE_HASH)
    }
    const { codeId, codeHash } = template
    const { api } = this
    const { logs, transactionHash } = await this.rateLimited(function doInstantiateInner () {
      // @ts-ignore
      return api.instantiate(Number(codeId), msg, label)
    }) as InstantiateResult
    return {
      chainId:  this.chain.id,
      codeId:   String(codeId),
      codeHash: codeHash,
      address:  logs[0].events[0].attributes[4].value,
      transactionHash,
    }
  }

  async getCodeId (address) {
    const { api } = this
    return await this.rateLimited(async function getCodeIdInner () {
      const { codeId } = await api.getContract(address)
      return String(codeId)
    }) as CodeId
  }

  async getLabel (address) {
    const { api } = this
    return await this.rateLimited(async function getLabelInner () {
      const { label } = await api.getContract(address)
      return label
    }) as string
  }

  async query <T, U> ({ address, codeHash }, msg: T) {
    const { api } = this
    return await this.rateLimited(function doQueryInner () {
      // @ts-ignore
      return api.queryContractSmart(address, msg, undefined, codeHash)
    }) as U
  }

  //@ts-ignore
  async execute ({ address, codeHash }, msg, opts) {
    const { memo, amount, fee } = opts
    return await this.api.execute(address, msg, memo, amount, fee, codeHash)
  }

  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error(constants.ERR_ENCRYPT_NO_CODE_HASH)
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

  initialWait = 1000

  config

  async rateLimited (fn) {
    //console.log('rateLimited', fn)
    let initialWait = 0
    if (this.chain.isMainnet && this.config?.datahub?.rateLimit) {
      initialWait = this.initialWait*Math.random()
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
      retry (error, attempt) {
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

export class LegacyScrtBundle extends ScrtBundle {

  agent

  static bundleCounter = 0

  get nonce () {
    return getNonce(this.chain, this.agent.address)
  }

  async encrypt (codeHash, msg) {
    return this.agent.encrypt(codeHash, msg)
  }

  async submit (memo = "") {
    this.assertCanSubmit()
    const msgs   = await this.buildForSubmit()
    const limit  = Number(ScrtGas.defaultFees.exec.amount[0].amount)
    const gas    = new ScrtGas(msgs.length*limit)
    const signed = await this.agent.signTx(msgs, gas, "")
    try {
      const txResult = await this.agent.api.postTx(signed)
      const results  = this.collectSubmitResults(msgs, txResult)
      return results
    } catch (err) {
      await this.handleSubmitError(err)
    }
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  async buildForSubmit () {
    const encrypted = await Promise.all(this.msgs.map(({init, exec})=>{
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
    return encrypted
  }

  collectSubmitResults (msgs, txResult) {
    const results = []
    for (const i in msgs) {
      results[i] = {
        sender:  this.address,
        tx:      txResult.transactionHash,
        type:    msgs[i].type,
        chainId: this.chain.id
      }
      if (msgs[i].type === 'wasm/MsgInstantiateContract') {
        const attrs = mergeAttrs(txResult.logs[i].events[0].attributes)
        results[i].label   = msgs[i].value.label,
        results[i].address = attrs.contract_address
        results[i].codeId  = attrs.code_id
      }
      if (msgs[i].type === 'wasm/MsgExecuteContract') {
        results[i].address = msgs[i].contract
      }
    }
    return results
  }

  async handleSubmitError (err) {
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
  async save (name) {
    // number of bundle, just for identification in console
    const N = ++LegacyScrtBundle.bundleCounter
    name = name || `TX.${N}.${+new Date()}`
    // get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.nonce
    // the base Bundle class stores messages
    // as (immediately resolved) promises
    const msgs = await this.buildForSave(this.msgs)
    // print the body of the bundle
    console.info(`Encrypted messages in bundle`, `#${N}:`)
    console.log()
    console.log(JSON.stringify(msgs))
    console.log()
    const finalUnsignedTx = this.finalizeForSave(msgs, name)
    console.log(JSON.stringify(
      { N, name, accountNumber, sequence, unsignedTxBody: finalUnsignedTx },
      null, 2
    ))
  }

  async buildForSave (msgs) {
    const encrypted = await Promise.all(msgs.map(({init, exec})=>{
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
    return encrypted
  }

  finalizeForSave (messages, memo) {
    const fee = new ScrtGas(10000000)
    const finalUnsignedTx = {
      body: {
        messages,
        memo,
        timeout_height: "0",
        extension_options: [],
        non_critical_extension_options: []
      },
      auth_info: {
        signer_infos: [],
        fee: { ...fee, gas: fee.gas, payer: "", granter: "" },
      },
      signatures: []
    }
    return finalUnsignedTx
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

export async function getNonce (url, address) {
  const sign = () => {throw new Error('unreachable')}
  const client = new SigningCosmWasmClient(url, address, sign)
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}

export class LegacyScrt extends ScrtChain {
  static Agent = LegacyScrtAgent
  // @ts-ignore
  Agent = LegacyScrt.Agent

  async getLabel (address: string): Promise<string> {
    throw new Error('TODO: Scrt#getLabel: use same method on agent')
  }

  async getCodeId (address: string): Promise<string> {
    throw new Error('TODO: Scrt#getCodeId: use same method on agent')
  }

  async getHash (address: string): Promise<string> {
    throw new Error('TODO: Scrt#getHash: use same method on agent')
  }

  // @ts-ignore
  async query <Q extends object> (instance: Instance, query: Q) {
    throw new Error('TODO: Scrt#query: use same method on agent')
  }
}

export function mergeAttrs (attrs) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}


export * from '@fadroma/client-scrt'
