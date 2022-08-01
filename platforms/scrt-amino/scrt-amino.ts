/*
  Fadroma Legacy Platform Package for Secret Network with Amino API
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

import {
  Address,
  AgentCtor,
  AgentOpts,
  Chain,
  ChainMode,
  CodeId,
  CodeHash,
  ExecOpts,
  ICoin,
  IFee,
  Instance,
  Label,
  Message,
  Scrt,
  ScrtAgent,
  ScrtAgentOpts,
  ScrtBundle,
  ScrtConfig,
  Template,
  Uint128
} from '@fadroma/scrt'

import {
  BroadcastMode,
  CosmWasmClient,
  EnigmaUtils,
  //ExecuteResult,
  InstantiateResult,
  PostTxResult,
  TxsResponse,
  Secp256k1Pen,
  SigningCosmWasmClient,
  encodeSecp256k1Pubkey,
  makeSignBytes,
  pubkeyToAddress, 
} from 'secretjs'

import { Bip39 } from '@cosmjs/crypto'

import { toBase64, fromBase64, fromUtf8 } from '@iov/encoding'

import { backOff } from 'exponential-backoff'

import { default as Axios, AxiosInstance } from 'axios'

export const ScrtAminoErrors = {
  ZeroRecipients:     () => new Error('Tried to send to 0 recipients'),
  TemplateNoCodeHash: () => new Error('Template must contain codeHash'),
  EncryptNoCodeHash:  () => new Error('Missing code hash'),
  UploadBinary:       () => new Error('The upload method takes a Uint8Array')
}

export const ScrtAminoWarnings = {
  Keypair () {
    console.warn(`ScrtAgent: Keypair doesn't match mnemonic, ignoring keypair`)
  },
}

export const privKeyToMnemonic = (privKey: Uint8Array) => (Bip39.encode(privKey) as any).data

interface SigningPen {
  pubkey: Uint8Array,
  sign:   Function
}

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export class ScrtAmino extends Scrt {

  static Chains = {
    async 'ScrtAminoMainnet' (config: ScrtConfig) {
      const mode = ChainMode.Mainnet
      const id   = config.scrtMainnetChainId  ?? Scrt.defaultMainnetChainId
      const url  = config.scrtMainnetAminoUrl ?? Scrt.defaultMainnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
    async 'ScrtAminoTestnet' (config: ScrtConfig) {
      const mode = ChainMode.Testnet
      const id   = config.scrtTestnetChainId  ?? Scrt.defaultTestnetChainId
      const url  = config.scrtTestnetAminoUrl ?? Scrt.defaultTestnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
  }

  // @ts-ignore
  Agent = ScrtAmino.Agent

  api = new CosmWasmClient(this.url)

  get block () {
    return this.api.getBlock()
  }

  get height () {
    return this.block.then(block=>block.header.height)
  }

  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenom, address: Address) {
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

  async getCodeId (address: Address) {
    const { api } = this
    const { codeId } = await api.getContract(address)
    return String(codeId)
  }

  async getLabel (address: Address) {
    const { api } = this
    const { label } = await api.getContract(address)
    return label
  }

  async query <T, U> ({ address, codeHash }: Instance, msg: T) {
    const { api } = this
    // @ts-ignore
    return api.queryContractSmart(address, msg, undefined, codeHash)
  }

  static Agent: AgentCtor<ScrtAminoAgent>
}

/** Amino-specific configuration objects for the agent. */
export interface ScrtAminoAgentOpts extends ScrtAgentOpts {
  keyPair: { privkey: Uint8Array }|null
  pen:     SigningPen
}

export class ScrtAminoAgent extends ScrtAgent {

  static async create (chain: ScrtAmino, options: ScrtAminoAgentOpts) {
    const { name = 'Anonymous', ...args } = options
    let   { mnemonic, keyPair } = options
    switch (true) {
      case !!mnemonic:
        // if keypair doesnt correspond to the mnemonic, delete the keypair
        if (keyPair && mnemonic !== privKeyToMnemonic(keyPair.privkey)) {
          ScrtAminoWarnings.Keypair()
          keyPair = null
        }
        break
      case !!keyPair:
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = privKeyToMnemonic(keyPair!.privkey)
        break
      default:
        // if there is neither, generate a new keypair and corresponding mnemonic
        keyPair  = EnigmaUtils.GenerateNewKeyPair()
        mnemonic = privKeyToMnemonic(keyPair.privkey)
    }
    return new ScrtAminoAgent(chain, {
      ...args,
      name,
      mnemonic,
      pen: await Secp256k1Pen.fromMnemonic(mnemonic!),
      keyPair
    })
  }

  constructor (chain: ScrtAmino, options: Partial<ScrtAminoAgentOpts> = {}) {
    super(chain, options)
    this.name     = options?.name || ''
    // @ts-ignore
    this.fees     = options?.fees || Scrt.defaultFees
    this.keyPair  = options?.keyPair
    this.mnemonic = options?.mnemonic
    this.pen      = options?.pen
    if (this.pen) {
      this.pubkey   = encodeSecp256k1Pubkey(options?.pen!.pubkey)
      this.address  = pubkeyToAddress(this.pubkey, 'secret')
      this.sign     = this.pen.sign.bind(this.pen)
      this.seed     = EnigmaUtils.GenerateNewSeed()
    }
  }

  readonly keyPair
  readonly mnemonic
  readonly pen?: SigningPen
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

  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenom, address: Address = this.address) {
    const account = await this.api.getAccount(address)
    const balance = account!.balance || []
    const inDenom = ({denom}:{denom: string}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }

  async send (to: Address, amounts: any, opts?: any): Promise<PostTxResult> {
    return await this.api.sendTokens(to, amounts, opts?.memo)
  }

  async sendMany (outputs: any, opts?: any) {
    if (outputs.length < 0) throw ScrtAminoErrors.ZeroRecipients()
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber: number
    let sequence:      number
    const msg = await Promise.all(outputs.map(async ([to_address, amount]:[Address, Uint128])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const memo      = opts?.memo
    const fee       = opts?.fee || Scrt.gas(500000 * outputs.length)
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber!, sequence!)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async upload (data: Uint8Array): Promise<Template> {
    if (!(data instanceof Uint8Array)) throw ScrtAminoErrors.UploadBinary()
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") codeId = uploadResult.logs[0].events[0].attributes[3].value
    const codeHash = uploadResult.originalChecksum
    return new Template(
      undefined, // TODO pass Artifact as 2nd arg to method - or unify Source/Artifact/Template outright
      codeHash,
      this.chain.id,
      codeId,
      uploadResult.transactionHash
    )
  }

  async instantiate <T> (template: Template, label: string, msg: T, funds = []) {
    if (!template.codeHash) throw ScrtAminoErrors.TemplateNoCodeHash()
    const { codeId, codeHash } = template
    const { api } = this
    //@ts-ignore
    const { logs, transactionHash } = await api.instantiate(Number(codeId), msg, label, funds)
    const address = logs![0].events[0].attributes[4].value
    return {
      chainId: this.chain.id,
      codeId:  String(codeId),
      codeHash,
      address,
      transactionHash,
    }
  }

  async getHash (idOrAddr: number|string): Promise<CodeHash> {
    const { api } = this
    if (typeof idOrAddr === 'number') {
      return await api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }

  async getCodeId (address: Address): Promise<CodeId> {
    return String((await this.api.getContract(address)).codeId)
  }

  async getLabel (address: Address): Promise<Label> {
    return (await this.api.getContract(address)).label
  }

  async query <T, U> ({ address, codeHash }: Instance, msg: T): Promise<U> {
    // @ts-ignore
    return await this.api.queryContractSmart(address, msg, undefined, codeHash)
  }

  async execute (
    { address, codeHash }: Instance, msg: Message, opts: ExecOpts = {}
  ): Promise<TxsResponse> {
    const { memo, send, fee } = opts
    return await this.api.execute(address, msg, memo, send, fee, codeHash)
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) throw ScrtAminoErrors.EncryptNoCodeHash()
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg as object)
    return toBase64(encrypted)
  }

  async signTx (msgs: any[], gas: IFee, memo: string = '') {
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

}

//@ts-ignore
ScrtAmino.Agent = ScrtAminoAgent

class ScrtAminoBundle extends ScrtBundle {
  declare agent: ScrtAminoAgent
  static bundleCounter = 0
  get nonce () {
    return getNonce(this.chain.url, this.agent.address)
  }
  async encrypt (codeHash: CodeHash, msg: any) {
    return this.agent.encrypt(codeHash, msg)
  }
  async submit (memo = "") {
    this.assertCanSubmit()
    const msgs   = await this.buildForSubmit()
    const limit  = Number(Scrt.defaultFees.exec.amount[0].amount)
    const gas    = Scrt.gas(msgs.length*limit)
    const signed = await this.agent.signTx(msgs, gas, memo)
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
  collectSubmitResults (msgs: any[], txResult: any): any[] {
    const results: any[] = []
    for (const i in msgs) {
      const result: Record<string, unknown> = {
        sender:  this.address,
        tx:      txResult.transactionHash,
        type:    msgs[i].type,
        chainId: this.chain.id
      }
      if (msgs[i].type === 'wasm/MsgInstantiateContract') {
        type Attrs = { contract_address: Address, code_id: unknown }
        const attrs = mergeAttrs(txResult.logs[i].events[0].attributes) as Attrs
        result.label   = msgs[i].value.label,
        result.address = attrs.contract_address
        result.codeId  = attrs.code_id
      }
      if (msgs[i].type === 'wasm/MsgExecuteContract') {
        result.address = msgs[i].contract
      }
      results[Number(i)] = result
    }
    return results
  }
  async handleSubmitError (err: Error) {
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
  async save (name: string) {
    // number of bundle, just for identification in console
    const N = ++ScrtAminoBundle.bundleCounter
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
  async buildForSave (msgs: { init: any, exec: any }[]) {
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
  finalizeForSave (messages: unknown[], memo: string) {
    const fee = Scrt.gas(10000000)
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

const init1 = (sender: Address, code_id: any, label: any, init_msg: any, init_funds: any) => ({
  "type": 'wasm/MsgInstantiateContract',
  value: { sender, code_id, label, init_msg, init_funds }
})

const init2 = (sender: Address, code_id: any, label: any, init_msg: any, init_funds: any) => ({
  "@type": "/secret.compute.v1beta1.MsgInstantiateContract",
  callback_code_hash: "", callback_sig: null,
  sender, code_id, label, init_msg, init_funds,
})

const exec1 = (sender: Address, contract: Address, msg: any, sent_funds: any) => ({
  "type": 'wasm/MsgExecuteContract',
  value: { sender, contract, msg, sent_funds }
})

const exec2 = (sender: Address, contract: Address, msg: any, sent_funds: any) => ({
  "@type": '/secret.compute.v1beta1.MsgExecuteContract',
  callback_code_hash: "", callback_sig: null,
  sender, contract, msg, sent_funds,
})

export async function getNonce (url: string, address: Address) {
  const sign = () => {throw new Error('unreachable')}
  const client = new SigningCosmWasmClient(url, address, sign)
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}

export function mergeAttrs (attrs: {key:string, value:string}[]) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

/** This is the latest version of the SigningCosmWasmClient async broadcast/retry patch. */

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

  _queryUrl = ''
  _queryClient: AxiosInstance|null = null
  get queryClient () {
    if (this._queryClient) return this._queryClient
    return this._queryClient = Axios.create({
      baseURL: this._queryUrl,
    })
  }

  async get (path: string|URL) {
    if (path instanceof URL) path = path.toString()
    const client = await this.queryClient
    const { data } = await client.get(path).catch(parseAxiosError) as { data: any }
    if (data === null) {
      throw new Error("Received null response from server")
    }
    return data
  }

  submitRetries      = 20
  resultSubmitDelay  = 1500
  blockQueryInterval = 1000
  resultRetries      = 20
  resultRetryDelay   = 3000

  // @ts-ignore
  async instantiate (codeId, initMsg, label, memo, transferAmount, fee, hash) {
    return await this.getTxResult((await super.instantiate(
      codeId, initMsg, label, memo, transferAmount, fee, hash
    )).transactionHash)
  }

  // @ts-ignore
  async execute (contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash) {
    return await this.getTxResult((await super.execute(
      contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash
    )).transactionHash)
  }

  async waitForNextBlock (sent: number) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }

  async waitForNextNonce (sent: number) {
    // TODO
    //while (true) {
      //await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      //const now = (await this.getBlock()).header.height
      //if (now > sent) break
    //}
  }

  // @ts-ignore
  async postTx (tx) {
    //console.trace('postTx', tx.msg)
    const info = (...args:any[]) => console.info('[@fadroma/scrt-amino][postTx]', ...args)
    const warn = (...args:any[]) => console.warn('[@fadroma/scrt-amino][postTx]', ...args)

    // 0. Validate that we're not sending an empty transaction
    if (!tx || !tx.msg || !tx.msg.length || tx.msg.length < 1) {
      console.trace('Tried to post a transaction with no messages from HERE')
      throw new Error('Tried to post a transaction with no messages.')
    }

    // 1. This patch only works in non-default broadcast modes (Sync or Async);
    //    in Block mode there is no way to get the tx hash of a half-failed TX.
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      warn('Broadcast mode is set to BroadcastMode.Block, bypassing patch')
      return super.postTx(tx)
    }

    // 2. Loop until we run out of retries or a TX result is successfully obtained.
    let id = null
    let submitRetries = this.submitRetries
    while (submitRetries--) {

      // 3. Store the block height at which the TX was sent
      const sent = (await this.getBlock()).header.height

      // 4. Submit the transaction
      try {
        info(`Submitting TX (${JSON.stringify(tx).length} chars) (${submitRetries} retries left)...`)
        //info(`Submitting TX (${JSON.stringify(tx).slice(0, 200)}...) (${submitRetries} retries left)...`)
        const result = await super.postTx(tx)
        id = result.transactionHash
      } catch (e) {
        if (this.shouldRetry(e.message)) {
          warn(`Submitting TX failed (${e.message}): ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
        } else {
          warn(`Submitting TX failed (${e.message}): not retrying`)
          throw e
        }
      }

      // 5. Wait for the block height to increment
      await this.waitForNextBlock(sent)

      // 6. If we got a transaction hash, start querying for the full transaction info.
      if (id) {
        try {
          return await this.getTxResult(id)
        } catch (e) {
          const weirdPanic = e.message.includes('Enclave: panicked due to unexpected behavior')
          if (this.shouldRetry(e.message) || weirdPanic) {
            warn("Enclave error: actually, let's retry this one...")
            // 7. If the transaction simply hasn't committed yet,
            //    query for the result again until we run out of retries.
            warn(`Getting result of TX ${id} failed (${e.message}): ${submitRetries} retries left...`)
            await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
          } else {
            // 8. If the transaction resulted in an error, rethrow it so it can be decrypted
            //    FIXME: is this necessary now that txById is being used?
            warn(`Getting result of TX ${id} failed (${e.message}): not retrying`)
            throw e
          }
        }
      }

    }

    throw new Error(`Submitting TX ${id} failed after ${this.submitRetries} retries.`)
  }

  async getTxResult (id: string) {
    const info = (...args: any[]) => console.info('[@fadroma/scrt-amino][getTxResult]', ...args)
    const warn = (...args: any[]) => console.warn('[@fadroma/scrt-amino][getTxResult]', ...args)

    // 1. Loop until we run out of retires or we successfully get a TX result
    let resultRetries = this.resultRetries
    while (resultRetries--) try {
      // 2. Try getting the transaction by id
      info(`[@fadroma/scrt] Requesting result of TX ${id}`)
      const result = await this.restClient.txById(id)
      const {raw_log, logs = []} = result
      // 3. If the raw log contains a known failure message, throw error
      if (!this.shouldRetry(raw_log, true)) {
        warn(`[@fadroma/scrt] TX ${id} failed`)
        throw new Error(raw_log)
      }
      // 4. Set tx hash and logs on the tx result and return it
      Object.assign(result, { transactionHash: id, logs })
      return result
    } catch (e) {
      if (this.shouldRetry(e.message)) {
        warn(`Getting result of TX ${id} failed (${e.message}): ${resultRetries} retries left...`)
        await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
      } else {
        warn(`Getting result of TX ${id} failed (${e.message}): not retrying`)
        throw e
      }
    }

    throw new Error(`Getting result of TX ${id} failed: ran out of retries.`)
  }

  shouldRetry (message: string, isActuallyOk = false) {

    const warn = (...args: any[]) => console.warn('[@fadroma/scrt-amino][shouldRetry]', ...args)

    if (message.includes('does not support Amino serialization')) {
      warn('Protocol mismatch, not retrying')
      return false
    }

    if (message.includes('404')) {
      warn('Commit lag, retrying')
      return true
    }

    // out of gas fails immediately
    if (message.includes('out of gas')) {
      warn('Out of gas, not retrying')
      return false
    }

    // account sequence mismatches are retried
    if (message.includes('account sequence mismatch')) {
      warn('Nonce lag, retrying')
      return true
    }

    // tx failures are thrown
    if (message.includes('failed')) {
      warn('TX failed, not retrying')
      return false
    }

    // all other errors are retried
    if (!isActuallyOk) {
      warn('Fetching tx result failed, retrying')
    } else {
      //console.info('[@fadroma/scrt] Fetching tx result succeeded')
    }
    return true

  }

}

function parseAxiosError (
  err: { response?: { status: string|number, data: { error?: string } } }
) {
  // use the error message sent from server, not default 500 msg
  if (err.response?.data) {
    let errorText
    const data = err.response.data
    // expect { error: string }, but otherwise dump
    if (data.error && typeof data.error === "string") {
      errorText = data.error
    } else if (typeof data === "string") {
      errorText = data
    } else {
      errorText = JSON.stringify(data)
    }
    throw new Error(`${errorText} (HTTP ${err.response.status})`)
  } else {
    throw err
  }
}

export * from '@fadroma/scrt'
