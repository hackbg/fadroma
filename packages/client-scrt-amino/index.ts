import {
  Agent, AgentOptions, Fees, Template, Instance,
  ScrtGas, ScrtChain
} from '@fadroma/client-scrt'
import { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
import { Bip39 } from '@cosmjs/crypto'
import {
  BroadcastMode,
  EnigmaUtils,
  Secp256k1Pen, encodeSecp256k1Pubkey, pubkeyToAddress, makeSignBytes,
  SigningCosmWasmClient,
  ExecuteResult
} from 'secretjs'
import { backOff } from 'exponential-backoff'

import { PatchedSigningCosmWasmClient_1_2 } from './patch'
import { LegacyScrtBundle } from './bundle'
import * as constants from './constants'

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
  ): Promise<LegacyScrtAgent> {
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
  /** Start a new transaction bundle. */
  bundle () {
    if (!this.Bundle) {
      throw new Error(constants.ERR_NO_BUNDLE)
    }
    return new this.Bundle(this)
  }

  fees   = ScrtGas.defaultFees
  defaultDenomination = 'uscrt'

  constructor (
    chain:   LegacyScrt,
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
      throw new Error(constants.ERR_ZERO_RECIPIENTS)
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

  async getHash (idOrAddr: number|string): Promise<string> {
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

  async upload (data: Uint8Array): Promise<Template> {
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
      chainId: this.chain.id,
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
    configs: [Template, string, object][],
  ): Promise<Instance[]> {
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const [template, label, initMsg] = configs[i]
      const instance = instances[i]
      if (instance) {
        instance.codeHash = template.codeHash
      }
    }
    return instances
  }

  async getCodeId (address: string): Promise<string> {
    const { api } = this
    return await this.rateLimited(async function getCodeIdInner () {
      const { codeId } = await api.getContract(address)
      return String(codeId)
    })
  }

  async getLabel (address: string): Promise<string> {
    const { api } = this
    return await this.rateLimited(async function getLabelInner () {
      const { label } = await api.getContract(address)
      return label
    })
  }

  async query <T, U> (
    { address, codeHash }: Instance, msg: T
  ): Promise<U> {
    const { api } = this
    return await this.rateLimited(function doQueryInner () {
      return api.queryContractSmart(address, msg as any, undefined, codeHash)
    })
  }

  async execute <T> (
    { address, codeHash }: Instance, msg: T, memo: any, amount: any, fee: any
  ): Promise<ExecuteResult> {
    return this.api.execute(address, msg as any, memo, amount, fee, codeHash)
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

export class LegacyScrtDeployer extends LegacyScrtAgent {
}

export class LegacyScrt extends ScrtChain {
  static Agent = LegacyScrtAgent
  Agent = LegacyScrt.Agent
}

export * from '@fadroma/client-scrt'
