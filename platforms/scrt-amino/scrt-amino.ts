/*
  Fadroma Platform Package for Secret Network with Legacy Amino API
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import * as SecretJS from 'secretjs-old' // this implementation uses secretjs 0.17
import * as Fadroma  from '@fadroma/scrt'
import { utf8, base64, bip39, bip39EN }  from '@hackbg/formati'
import { backOff } from 'exponential-backoff'
import { ScrtAminoError, ScrtAminoConsole } from './scrt-amino-events'
import { PatchedSigningCosmWasmClient_1_2 } from './scrt-amino-patch'

const log = new ScrtAminoConsole()

export const privKeyToMnemonic = (privKey: Uint8Array): string =>
  bip39.entropyToMnemonic(privKey, bip39EN)

/** Amino-specific Secret Network settings. */
export class ScrtAminoConfig extends Fadroma.ScrtConfig {
  scrtMainnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultMainnetAminoUrl)
  scrtTestnetAminoUrl: string|null
    = this.getString('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultTestnetAminoUrl)
}

/** The Secret Network, accessed via Amino protocol. */
export class ScrtAmino extends Fadroma.Scrt {
  static Agent: Fadroma.AgentClass<ScrtAminoAgent> // populated below
  static Config = ScrtAminoConfig
  static defaultMainnetAminoUrl: string|null = null
  static defaultTestnetAminoUrl: string|null = null
  static Chains = {
    async 'ScrtAminoMainnet' (config: ScrtAminoConfig) {
      const mode = Fadroma.ChainMode.Mainnet
      const id   = config.scrtMainnetChainId  ?? Fadroma.Scrt.defaultMainnetChainId
      const url  = config.scrtMainnetAminoUrl ?? ScrtAmino.defaultMainnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
    async 'ScrtAminoTestnet' (config: ScrtAminoConfig) {
      const mode = Fadroma.ChainMode.Testnet
      const id   = config.scrtTestnetChainId  ?? Fadroma.Scrt.defaultTestnetChainId
      const url  = config.scrtTestnetAminoUrl ?? ScrtAmino.defaultTestnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
    // devnet and mocknet modes are defined in @fadroma/connect
  }

  Agent: Fadroma.AgentClass<ScrtAminoAgent> = ScrtAmino.Agent
  API = SecretJS.CosmWasmClient
  get api () {
    return new this.API(this.url)
  }
  get block () {
    return this.api.getBlock()
  }
  get height () {
    return this.block.then(block=>block.header.height)
  }
  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenom, address: Fadroma.Address) {
    const account = await this.api.getAccount(address)
    const balance = account?.balance || []
    const inDenom = ({denom}:{denom:string}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }
  async getHash (idOrAddr: number|string) {
    const { api } = this
    if (typeof idOrAddr === 'number') {
      return await api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }
  async getCodeId (address: Fadroma.Address) {
    const { api } = this
    const { codeId } = await api.getContract(address)
    return String(codeId)
  }
  async getLabel (address: Fadroma.Address) {
    const { api } = this
    const { label } = await api.getContract(address)
    return label
  }
  async query <T, U> ({ address, codeHash }: Partial<Fadroma.Client>, msg: T) {
    const { api } = this
    // @ts-ignore
    return api.queryContractSmart(address, msg, undefined, codeHash)
  }
  /** Create a `ScrtAminoAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtAminoAgentOpts> = {},
    _Agent:  Fadroma.AgentClass<ScrtAminoAgent> = this.Agent
  ): Promise<ScrtAminoAgent> {
    const { name = 'Anonymous', ...args } = options
    let   { mnemonic, keyPair } = options
    // select authentication method
    switch (true) {
      case !!mnemonic:
        // if keypair doesnt correspond to the mnemonic, delete the keypair
        if (keyPair && mnemonic !== privKeyToMnemonic(keyPair.privkey)) {
          log.warnKeypair()
          keyPair = null
        }
        break
      case !!keyPair:
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = privKeyToMnemonic(keyPair!.privkey)
        break
      default:
        // if there is neither, generate a new keypair and corresponding mnemonic
        keyPair  = SecretJS.EnigmaUtils.GenerateNewKeyPair()
        mnemonic = privKeyToMnemonic(keyPair.privkey)
    }
    // construct options object
    options = {
      ...args,
      chain: this,
      name,
      mnemonic,
      pen: await SecretJS.Secp256k1Pen.fromMnemonic(mnemonic!),
      keyPair
    }
    // construct agent
    return await super.getAgent(options, _Agent) as ScrtAminoAgent
  }
}

/** Amino-specific configuration objects for the agent. */
export interface ScrtAminoAgentOpts extends Fadroma.ScrtAgentOpts {
  keyPair: { privkey: Uint8Array }|null
  pen:     SigningPen
}

interface SigningPen {
  pubkey: Uint8Array,
  sign:   Function
}

export class ScrtAminoAgent extends Fadroma.ScrtAgent {

  constructor (options: Partial<ScrtAminoAgentOpts> = {}) {
    super(options)
    this.name     = options?.name || ''
    // @ts-ignore
    this.fees     = options?.fees || Fadroma.Scrt.defaultFees
    this.keyPair  = options?.keyPair
    this.mnemonic = options?.mnemonic
    this.pen      = options?.pen
    if (this.pen) {
      this.pubkey   = SecretJS.encodeSecp256k1Pubkey(options?.pen!.pubkey)
      this.address  = SecretJS.pubkeyToAddress(this.pubkey, 'secret')
      this.sign     = this.pen.sign.bind(this.pen)
      this.seed     = SecretJS.EnigmaUtils.GenerateNewSeed()
    }
  }

  readonly keyPair
  readonly mnemonic
  readonly pen?: SigningPen
  readonly sign
  readonly pubkey
  readonly seed
  initialWait = 1000
  API = PatchedSigningCosmWasmClient_1_2
  get api () {
    if (!this.address) {
      throw new Error("No address, can't get API")
    }
    return new this.API(
      Fadroma.assertChain(this).url,
      this.address,
      this.sign,
      this.seed,
      this.fees,
      SecretJS.BroadcastMode.Sync
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
  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (
    denomination: string                    = this.defaultDenom,
    address:      Fadroma.Address|undefined = this.address
  ) {
    const account = await this.api.getAccount(address)
    const balance = account!.balance || []
    const inDenom = ({denom}:{denom: string}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }
  async send (to: Fadroma.Address, amounts: any, opts?: any): Promise<SecretJS.PostTxResult> {
    return await this.api.sendTokens(to, amounts, opts?.memo)
  }
  async sendMany (outputs: any, opts?: any) {
    if (outputs.length < 0) throw new ScrtAminoError.NoRecipients()
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber: number
    let sequence:      number
    const toMsg = async ([to_address, amount]: [Fadroma.Address, Fadroma.Uint128])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount}
      return { type: 'cosmos-sdk/MsgSend', value }
    }
    const msg = await Promise.all(outputs.map(toMsg))
    const memo      = opts?.memo
    const fee       = opts?.fee || Fadroma.Scrt.gas(500000 * outputs.length)
    const chainId   = Fadroma.assertChain(this).id
    const signBytes = SecretJS.makeSignBytes(msg, fee, chainId, memo, accountNumber!, sequence!)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }
  async upload (data: Uint8Array): Promise<Fadroma.ContractTemplate> {
    if (!(data instanceof Uint8Array)) throw new ScrtAminoError.NoUploadBinary()
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") codeId = uploadResult.logs[0].events[0].attributes[3].value
    return new Fadroma.ContractTemplate({
      artifact: undefined,
      codeHash: uploadResult.originalChecksum,
      chainId:  Fadroma.assertChain(this).id,
      codeId,
      uploadTx: uploadResult.transactionHash
    })
  }
  async instantiate (instance: Fadroma.ContractInstance): Promise<Fadroma.ContractInstance> {
    if (!instance.codeHash) throw new ScrtAminoError.NoCodeHashInTemplate()
    let { codeId, codeHash } = instance
    const { api } = this
    //@ts-ignore
    const { logs, transactionHash } = await api.instantiate(
      Number(codeId),
      await Fadroma.into(instance.initMsg),
      await Fadroma.into(instance.label),
      []
    )
    const address = logs![0].events[0].attributes[4].value
    codeId = String(codeId)
    const initTx = transactionHash
    return instance.provide({ address, codeHash })
  }
  async getHash (idOrAddr: number|string): Promise<Fadroma.CodeHash> {
    const { api } = this
    if (typeof idOrAddr === 'number') {
      return await api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }
  async getCodeId (address: Fadroma.Address): Promise<Fadroma.CodeId> {
    return String((await this.api.getContract(address)).codeId)
  }
  async getLabel (address: Fadroma.Address): Promise<Fadroma.Label> {
    return (await this.api.getContract(address)).label
  }
  async query <U> (
    { address, codeHash }: Partial<Fadroma.Client>, msg: Fadroma.Message
  ): Promise<U> {
    return await this.api.queryContractSmart(address!, msg as object, undefined, codeHash)
  }
  async execute (
    { address, codeHash }: Partial<Fadroma.Client>, msg: Fadroma.Message,
    opts: Fadroma.ExecOpts = {}
  ): Promise<SecretJS.TxsResponse> {
    const { memo, send, fee } = opts
    return await this.api.execute(address, msg, memo, send, fee, codeHash)
  }
  async encrypt (codeHash: Fadroma.CodeHash, msg: Fadroma.Message) {
    if (!codeHash) throw new ScrtAminoError.NoCodeHash()
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }
  async signTx (msgs: any[], gas: Fadroma.IFee, memo: string = '') {
    const { accountNumber, sequence } = await this.api.getNonce()
    return await this.api.signAdapter(
      msgs,
      gas,
      Fadroma.assertChain(this).id,
      memo,
      accountNumber,
      sequence
    )
  }
  async getNonce () {
    const { accountNumber, sequence } = await this.api.getNonce()
    return { accountNumber, sequence }
  }
}

class ScrtAminoBundle extends Fadroma.ScrtBundle {
  declare agent: ScrtAminoAgent
  get nonce () {
    if (!this.agent || !this.agent.address) throw new Error("Missing address, can't get nonce")
    return getNonce(Fadroma.assertChain(this).url, this.agent.address)
  }
  async submit (memo = "") {
    const results: any[] = []
    /** Format the messages for API v1 like secretjs and encrypt them. */
    const init1 = (
      sender: Fadroma.Address, code_id: any, label: any, init_msg: any, init_funds: any
    ) => ({
      "type": 'wasm/MsgInstantiateContract',
      value: { sender, code_id, label, init_msg, init_funds }
    })
    const exec1 = (
      sender: Fadroma.Address, contract: Fadroma.Address, msg: any, sent_funds: any
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
    const limit  = Number(Fadroma.Scrt.defaultFees.exec.amount[0].amount)
    const gas    = Fadroma.Scrt.gas(msgs.length*limit)
    const signed = await this.agent.signTx(msgs, gas, memo)
    try {
      const txResult = await this.agent.api.postTx(signed)
      for (const i in msgs) {
        const result: Record<string, unknown> = {
          sender:  this.address,
          tx:      txResult.transactionHash,
          type:    msgs[i].type,
          chainId: Fadroma.assertChain(this).id
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          type Attrs = { contract_address: Fadroma.Address, code_id: unknown }
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

export async function getNonce (url: string, address: Fadroma.Address): Promise<ScrtNonce> {
  const sign = () => {throw new Error('unreachable')}
  const client = new SecretJS.SigningCosmWasmClient(url, address, sign)
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export function mergeAttrs (attrs: {key:string, value:string}[]) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

ScrtAmino.Agent        = ScrtAminoAgent
ScrtAmino.Agent.Bundle = ScrtAminoBundle

export * from '@fadroma/scrt'
export { SecretJS }
export { PatchedSigningCosmWasmClient_1_2 }
export { ScrtAminoError, ScrtAminoConsole }
