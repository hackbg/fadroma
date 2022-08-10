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

import * as SecretJS from 'secretjs' // this implementation uses secretjs 0.17.5
import * as Fadroma  from '@fadroma/scrt'
import * as Formati  from '@hackbg/formati'
import * as Konfizi  from '@hackbg/konfizi'
import { backOff }   from 'exponential-backoff'
import { default as Axios, AxiosInstance } from 'axios'

export const ScrtAminoErrors = {
  ZeroRecipients:     () => new Error('Tried to send to 0 recipients'),
  TemplateNoCodeHash: () => new Error('Template must contain codeHash'),
  EncryptNoCodeHash:  () => new Error('Missing code hash'),
  UploadBinary:       () => new Error('The upload method takes a Uint8Array'),
  NoAPIUrl:           () => new Error('ScrtAmino: no Amino API URL')
}

export const ScrtAminoWarnings = {
  Keypair () {
    console.warn(`ScrtAgent: Keypair doesn't match mnemonic, ignoring keypair`)
  },
}

export const privKeyToMnemonic = (privKey: Uint8Array) =>
  (Formati.Bip39.encode(privKey) as any).data

/** Amino-specific Secret Network settings. */
export interface ScrtAminoConfig extends Fadroma.ScrtConfig {
  scrtMainnetAminoUrl: string|null
  scrtTestnetAminoUrl: string|null
}

/** The Secret Network, accessed via Amino protocol. */
export class ScrtAmino extends Fadroma.Scrt {

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

  static getConfig = function getScrtAminoConfig (
    cwd: string,
    env: Record<string, string> = {}
  ): ScrtAminoConfig {
    const { Str, Bool } = Konfizi.getFromEnv(env)
    return {
      scrtAgentName:       Str('SCRT_AGENT_NAME',        ()=>null),
      scrtAgentAddress:    Str('SCRT_AGENT_ADDRESS',     ()=>null),
      scrtAgentMnemonic:   Str('SCRT_AGENT_MNEMONIC',    ()=>null),
      scrtMainnetChainId:  Str('SCRT_MAINNET_CHAIN_ID',  ()=>Fadroma.Scrt.defaultMainnetChainId),
      scrtMainnetAminoUrl: Str('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultMainnetAminoUrl),
      scrtTestnetChainId:  Str('SCRT_TESTNET_CHAIN_ID',  ()=>Fadroma.Scrt.defaultTestnetChainId),
      scrtTestnetAminoUrl: Str('SCRT_MAINNET_AMINO_URL', ()=>ScrtAmino.defaultTestnetAminoUrl),
    }
  }

  static defaultMainnetAminoUrl: string|null = null
  static defaultTestnetAminoUrl: string|null = null

  static Agent: Fadroma.AgentCtor<ScrtAminoAgent>
         Agent: Fadroma.AgentCtor<ScrtAminoAgent> = ScrtAmino.Agent

  api = new SecretJS.CosmWasmClient(this.url)

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

  async query <T, U> ({ address, codeHash }: Fadroma.Instance, msg: T) {
    const { api } = this
    // @ts-ignore
    return api.queryContractSmart(address, msg, undefined, codeHash)
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
        keyPair  = SecretJS.EnigmaUtils.GenerateNewKeyPair()
        mnemonic = privKeyToMnemonic(keyPair.privkey)
    }
    return new ScrtAminoAgent(chain, {
      ...args,
      name,
      mnemonic,
      pen: await SecretJS.Secp256k1Pen.fromMnemonic(mnemonic!),
      keyPair
    })
  }

  constructor (chain: ScrtAmino, options: Partial<ScrtAminoAgentOpts> = {}) {
    super(chain, options)
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

  API = PatchedSigningCosmWasmClient_1_2

  get api () {
    return new this.API(
      this.chain?.url,
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
    denomination: string          = this.defaultDenom,
    address:      Fadroma.Address = this.address
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
    if (outputs.length < 0) throw ScrtAminoErrors.ZeroRecipients()
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
    const chainId   = this.chain.id
    const signBytes = SecretJS.makeSignBytes(msg, fee, chainId, memo, accountNumber!, sequence!)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async upload (data: Uint8Array): Promise<Fadroma.Template> {
    if (!(data instanceof Uint8Array)) throw ScrtAminoErrors.UploadBinary()
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") codeId = uploadResult.logs[0].events[0].attributes[3].value
    const codeHash = uploadResult.originalChecksum
    return new Fadroma.Template(
      undefined, // TODO pass Artifact as 2nd arg to method - or unify Source/Artifact/Template?
      codeHash,
      this.chain.id,
      codeId,
      uploadResult.transactionHash
    )
  }

  async instantiate <T> (template: Fadroma.Template, label: string, msg: T, funds = []) {
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

  async query <T, U> ({ address, codeHash }: Fadroma.Instance, msg: T): Promise<U> {
    // @ts-ignore
    return await this.api.queryContractSmart(address, msg, undefined, codeHash)
  }

  async execute (
    { address, codeHash }: Fadroma.Instance, msg: Fadroma.Message, opts: Fadroma.ExecOpts = {}
  ): Promise<SecretJS.TxsResponse> {
    const { memo, send, fee } = opts
    return await this.api.execute(address, msg, memo, send, fee, codeHash)
  }

  async encrypt (codeHash: Fadroma.CodeHash, msg: Fadroma.Message) {
    if (!codeHash) throw ScrtAminoErrors.EncryptNoCodeHash()
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg as object)
    return Formati.toBase64(encrypted)
  }

  async signTx (msgs: any[], gas: Fadroma.IFee, memo: string = '') {
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

class ScrtAminoBundle extends Fadroma.ScrtBundle {

  declare agent: ScrtAminoAgent

  get nonce () {
    return getNonce(this.chain.url, this.agent.address)
  }

  async submit (memo = "") {

    const results: any[] = []

    this.assertCanSubmit()

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

    const msgs = await Promise.all(this.msgs.map(({init, exec})=>{
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        const toMsg = (msg: unknown) =>init1(sender, String(codeId), label, msg, funds)
        return this.agent.encrypt(codeHash, msg).then(toMsg)
      }
      if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        return this.agent.encrypt(codeHash, msg).then(msg=>exec1(sender, contract, msg, funds))
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
          chainId: this.chain.id
        }
        if (msgs[i].type === 'wasm/MsgInstantiateContract') {
          type Attrs = { contract_address: Fadroma.Address, code_id: unknown }
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

    } catch (err) {

      try {

        console.error('Submitting bundle failed:', err.message)
        console.error('Trying to decrypt...')

        const errorMessageRgx = /failed to execute message; message index: (\d+): encrypted: (.+?): (?:instantiate|execute|query) contract failed/g;
        const rgxMatches = errorMessageRgx.exec(err.message);
        if (rgxMatches == null || rgxMatches.length != 3) throw err;
        const errorCipherB64 = rgxMatches[1]
        const errorCipherBz  = Formati.fromBase64(errorCipherB64)
        const msgIndex       = Number(rgxMatches[2])
        const msg            = await this.msgs[msgIndex]
        const nonce          = Formati.fromBase64(msg.value.msg).slice(0, 32)
        const errorPlainBz   = await this.agent.api.restClient.enigmautils.decrypt(errorCipherBz, nonce)
        err.message = err.message.replace(errorCipherB64, Formati.fromUtf8(errorPlainBz))

      } catch (decryptionError) {

        console.error('Failed to decrypt :(')
        throw new Error(
          `Failed to decrypt the following error message: ${err.message}. `+
          `Decryption error of the error message: ${(decryptionError as Error).message}`
        )

      }

      throw err
    }

    return results

  }

}

export async function getNonce (url: string, address: Fadroma.Address) {
  const sign = () => {throw new Error('unreachable')}
  const client = new SecretJS.SigningCosmWasmClient(url, address, sign)
  const { accountNumber, sequence } = await client.getNonce()
  return { accountNumber, sequence }
}

export function mergeAttrs (attrs: {key:string, value:string}[]) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

/** This is the latest version of the SigningCosmWasmClient async broadcast/retry patch. */

export class PatchedSigningCosmWasmClient_1_2 extends SecretJS.SigningCosmWasmClient {

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
    )).transactionHash) as any
  }

  // @ts-ignore
  async execute (contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash) {
    return await this.getTxResult((await super.execute(
      contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash
    )).transactionHash) as any
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
    if (this.restClient.broadcastMode === SecretJS.BroadcastMode.Block) {
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
        info(
          `Submitting TX (${JSON.stringify(tx).length} chars) (${submitRetries} retries left)...`
        )
        const result = await super.postTx(tx)
        id = result.transactionHash
      } catch (e) {
        const { message } = e as Error
        if (this.shouldRetry(message)) {
          warn(`Submitting TX failed (${message}): ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
        } else {
          warn(`Submitting TX failed (${message}): not retrying`)
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
          const { message } = e as Error
          const weirdPanic = message.includes('Enclave: panicked due to unexpected behavior')
          if (this.shouldRetry(message) || weirdPanic) {
            warn("Enclave error: actually, let's retry this one...")
            // 7. If the transaction simply hasn't committed yet,
            //    query for the result again until we run out of retries.
            warn(
              `Getting result of TX ${id} failed (${message}): ${submitRetries} retries left...`
            )
            await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
          } else {
            // 8. If the transaction resulted in an error, rethrow it so it can be decrypted
            //    FIXME: is this necessary now that txById is being used?
            warn(`Getting result of TX ${id} failed (${message}): not retrying`)
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
      return result as any
    } catch (e) {
      const { message } = e as Error
      if (this.shouldRetry(message)) {
        warn(`Getting result of TX ${id} failed (${message}): ${resultRetries} retries left...`)
        await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
      } else {
        warn(`Getting result of TX ${id} failed (${message}): not retrying`)
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

export interface ScrtNonce {
  accountNumber: number
  sequence:      number
}

export * from '@fadroma/scrt'
