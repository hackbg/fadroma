import Error from './ScrtError'
import Console from './ScrtConsole'
import Scrt from './ScrtChain'
import type ScrtBundle from './ScrtBundle'

import {
  Agent, Contract, assertAddress, assertChain, into, base64, bip39, bip39EN
} from '@fadroma/agent'
import type {
  Address, AgentClass, AgentOpts, Built, Uploaded,
  BundleClass, Client, CodeHash, ExecOpts, ICoin, Label, Message,
  Name, AnyContract
} from '@fadroma/agent'

import type * as SecretJS from 'secretjs'

export type TxResponse = SecretJS.TxResponse

export interface ScrtAgentClass extends AgentClass<ScrtAgent> {}

/** Agent configuration options for Secret Network. */
export interface ScrtAgentOpts extends AgentOpts {
  /** Instance of the underlying platform API provided by `secretjs`. */
  api:             SecretJS.SecretNetworkClient
  /** This agent's identity on the chain. */
  wallet:          SecretJS.Wallet
  /** Whether to simulate each execution first to get a more accurate gas estimate. */
  simulate:        boolean
  /** Provide this to allow SecretJS to sign with keys stored in Keplr. */
  encryptionUtils: SecretJS.EncryptionUtils
}

/** Represents a connection to the Secret Network,
  * authenticated as a specific address. */
export default class ScrtAgent extends Agent {

  constructor (options: Partial<ScrtAgentOpts> = {}) {
    super(options)
    this.fees = options.fees ?? this.fees
    this.api = options.api
    this.wallet = options.wallet
    this.address = this.wallet?.address
    this.encryptionUtils = options.encryptionUtils
    this.simulate = options.simulate ?? this.simulate
    this.log.label = `${this.address} on Secret Network ${this.chain.id}`
  }

  get ready (): Promise<this & { api: SecretJS.SecretNetworkClient }> {
    const init = new Promise<this & { api: SecretJS.SecretNetworkClient }>(async (resolve, reject)=>{
      try {
        const _SecretJS = this.chain.SecretJS
        let wallet = this.wallet
        if (!wallet || wallet instanceof _SecretJS.ReadonlySigner) {
          // If this is a named devnet agent
          if (this.name && this.chain.isDevnet && this.chain.devnet) {
            // Provide mnemonic from devnet genesis accounts
            await this.chain.devnet.respawn()
            this.mnemonic = (await this.chain.devnet.getGenesisAccount(this.name)).mnemonic!
          }
          // If there is still no mnemonic
          if (!this.mnemonic) {
            // Generate fresh mnemonic
            this.mnemonic = bip39.generateMnemonic(bip39EN)
            this.log.warnGeneratedMnemonic(this.mnemonic!)
          }
          wallet = new _SecretJS.Wallet(this.mnemonic)
        } else if (this.mnemonic) {
          this.log.warnIgnoringMnemonic()
        }
        // Construct the API client
        const url = removeTrailingSlash(this.chain.url)
        const chainId = this.chain.id
        const walletAddress = wallet?.address || this.address
        const { encryptionUtils } = this
        const apiOptions = { chainId, url, wallet, walletAddress, encryptionUtils }
        this.api = await this.chain?.getApi(apiOptions)
        // Optional: override api.encryptionUtils (e.g. with the ones from Keplr).
        if (encryptionUtils) Object.assign(this.api, { encryptionUtils })
        // If fees are not specified, get default fees from API.
        if (!this.fees) {
          this.fees = Scrt.defaultFees
          try {
            const max = Scrt.gas((await this.chain.fetchLimits()).gas)
            this.fees = { upload: max, init: max, exec: max, send: max }
          } catch (e) {
            this.log.warn(e)
            this.log.warnCouldNotFetchBlockLimit(Object.values(this.fees))
          }
        }
        // Override address and set name if missing.
        this.address = wallet.address
        this.name ??= this.address
        // Done.
        resolve(this as this & { api: SecretJS.SecretNetworkClient })
      } catch (e) {
        reject(e)
      }
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

  declare chain: Scrt

  log = new Console('ScrtGrpcAgent')

  Bundle: BundleClass<ScrtBundle> = ScrtAgent.Bundle

  get api (): SecretJS.SecretNetworkClient|undefined {
    return undefined
  }
  set api (value: SecretJS.SecretNetworkClient|undefined) {
    setApi(this, value)
  }

  get wallet (): SecretJS.Wallet|undefined {
    return (this.api as any)?.wallet
  }
  set wallet (value: SecretJS.Wallet|undefined) {
    setWallet(this, value)
  }

  get encryptionUtils (): SecretJS.EncryptionUtils|undefined {
    return (this.api as any)?.encryptionUtils
  }
  set encryptionUtils (value: SecretJS.EncryptionUtils|undefined) {
    setEncryptionUtils(this, value)
  }

  /** Whether transactions should be simulated instead of executed. */
  simulate: boolean = false

  fees = Scrt.defaultFees

  get account () {
    return this.ready.then(()=>this.api!.query.auth.account({ address: assertAddress(this) }))
  }

  get balance () {
    return this.ready.then(()=>this.getBalance(this.defaultDenom, assertAddress(this)))
  }

  async getBalance (denom = this.defaultDenom, address: Address): Promise<string> {
    const { api } = await this.ready
    const response = await api.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async send (to: Address, amounts: ICoin[], opts?: any) {
    const { api } = await this.ready
    const from_address = assertAddress(this)
    const to_address = to
    const amount = amounts
    const msg = { from_address, to_address, amount }
    return api.tx.bank.send(msg, { gasLimit: opts?.gas?.gas })
  }

  async sendMany (outputs: never, opts: never) {
    throw new Error('ScrtAgent#sendMany: not implemented')
  }

  async getLabel (contract_address: string): Promise<string> {
    const { api } = await this.ready
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: string): Promise<string> {
    const { api } = await this.ready
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getHash (arg: string|number): Promise<string> {
    const { api } = await this.ready
    if (typeof arg === 'number' || !isNaN(Number(arg))) {
      return (await api.query.compute.codeHashByCodeId({
        code_id: String(arg)
      })).code_hash!
    } else {
      return (await api.query.compute.codeHashByContractAddress({
        contract_address: arg
      })).code_hash!
    }
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const { api } = await this.ready
    if (!this.address) throw new Error("No address")
    const failed = ()=>{
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    }
    const result = await api.query.auth.account({ address: this.address }) ?? failed()
    const { account_number, sequence } = result.account as any
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) throw new Error.NoCodeHash()
    const { api } = await this.ready
    const { encryptionUtils } = await this.api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }

  /** Query a Client.
    * @returns the result of the query */
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    const { api } = await this.ready
    return await api.query.compute.queryContract({
      contract_address: instance.address!,
      code_hash:        instance.codeHash,
      query: query as Record<string, unknown>
    }) as U
  }

  /** Upload a WASM binary. */
  async upload (data: Uint8Array): Promise<Uploaded> {
    const { api } = await this.ready
    type Log = { type: string, key: string }
    if (!this.address) throw new Error("No address")
    const request  = { sender: this.address, wasm_byte_code: data, source: "", builder: "" }
    const gasLimit = Number(this.fees.upload?.amount[0].amount) || undefined
    const result   = await api.tx.compute.storeCode(request, { gasLimit })
    if (result.code !== 0) {
      this.log.warn(`Upload failed with result`, result)
      throw Object.assign(new Error.UploadFailed(), { result })
    }
    const codeId = result.arrayLog
      ?.find((log: Log) => log.type === "message" && log.key === "code_id")
      ?.value
    if (!codeId) { throw Object.assign(new Error.UploadFailed(), { noCodeId: true }) }
    return {
      chainId:  assertChain(this).id,
      codeId,
      codeHash: await this.getHash(Number(codeId)),
      uploadBy: this.address,
      uploadTx: result.transactionHash
    }
  }

  async instantiate <C extends Client> (
    instance: Contract<C>,
    init_funds: ICoin[] = []
  ) {
    const { api } = await this.ready
    if (!this.address) throw new Error("No address")
    const { chainId, codeId, codeHash, label, initMsg } = instance
    const code_id = Number(instance.codeId)
    if (isNaN(code_id)) throw new Error.CantInit_NoCodeId()
    if (!label) throw new Error.CantInit_NoLabel()
    if (!initMsg) throw new Error.CantInit_NoMessage()
    if (chainId && chainId !== assertChain(this).id) {
      throw new Error.WrongChain()
    }
    const result = await api.tx.compute.instantiateContract({
      sender: this.address,
      code_id,
      code_hash: codeHash!,
      init_msg: await into(initMsg),
      label,
      init_funds
    }, {
      gasLimit: Number(this.fees.init?.amount[0].amount) || undefined
    })
    if (result.code !== 0) {
      this.log.error('Init failed:', { initMsg, result })
      throw Object.assign(new Error.InitFailed(code_id), { result })
    }
    type Log = { type: string, key: string }
    const address  = result.arrayLog!
      .find((log: Log) => log.type === "message" && log.key === "contract_address")
      ?.value!
    return {
      chainId: chainId!,
      address,
      codeHash: codeHash!,
      initTx: result.transactionHash,
      initBy: this.address,
      label,
    }
  }

  //instantiateMany (instances: Record<Name, AnyContract>):
    //Promise<Record<Name, AnyContract>>
  //instantiateMany (instances: AnyContract[]):
    //Promise<AnyContract[]>
  //async instantiateMany <C> (instances: C): Promise<C> {
    //// instantiate multiple contracts in a bundle:
    //const response = await this.bundle().wrap(async bundle=>{
      //await bundle.instantiateMany(template, configs)
    //})
    //// add code hashes to them:
    //for (const i in configs) {
      //const instance = instances[i]
      //if (instance) {
        //instance.codeId   = template.codeId
        //instance.codeHash = template.codeHash
        //instance.label    = configs[i][0]
      //}
    //}
    //return instances
  //}

  async execute (
    instance: Partial<Client>, msg: Message, opts: ExecOpts = {}
  ): Promise<TxResponse> {
    const { api } = await this.ready
    if (!this.address) throw new Error("No address")
    const { address, codeHash } = instance
    const { send, memo, fee = this.fees.exec } = opts
    if (memo) this.log.warnNoMemos()
    const tx = {
      sender:           this.address,
      contract_address: instance.address!,
      code_hash:        instance.codeHash,
      msg:              msg as Record<string, unknown>,
      sentFunds:        send
    }
    const txOpts = {
      gasLimit: Number(fee?.gas) || undefined
    }
    if (this.simulate) {
      this.log.info('Simulating transaction...')
      let simResult
      try {
        simResult = await api.tx.compute.executeContract.simulate(tx, txOpts)
      } catch (e) {
        this.log.error(e)
        this.log.warn('TX simulation failed:', tx, 'from', this)
      }
      const gas_used = simResult?.gas_info?.gas_used
      if (gas_used) {
        this.log.info('Simulation used gas:', gas_used)
        const gas = Math.ceil(Number(gas_used) * 1.1)
        // Adjust gasLimit up by 10% to account for gas estimation error
        this.log.info('Setting gas to 110% of that:', gas)
        txOpts.gasLimit = gas
      }
    }
    const result = await api.tx.compute.executeContract(tx, txOpts)
    // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
    if (result.code !== 0) {
      const error = `ScrtAgent#execute: gRPC error ${result.code}: ${result.rawLog}`
      // make the original result available on request
      const original = structuredClone(result)
      Object.defineProperty(result, "original", {
        enumerable: false,
        get () { return original }
      })
      // decode the values in the result
      const txBytes = tryDecode(result.tx as Uint8Array)
      Object.assign(result, { txBytes })
      for (const i in result.tx.signatures) {
        //@ts-ignore
        result.tx.signatures[i] = tryDecode(result.tx.signatures[i])
      }
      for (const event of result.events) {
        for (const attr of event?.attributes ?? []) {
          //@ts-ignore
          try { attr.key   = tryDecode(attr.key)   } catch (e) {}
          //@ts-ignore
          try { attr.value = tryDecode(attr.value) } catch (e) {}
        }
      }
      throw Object.assign(new Error(error), result)
    }
    return result as TxResponse
  }

  decryptAndThrow (result: TxResponse) {}

  static Bundle: BundleClass<ScrtBundle> // populated in index

}

/** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
const decoder = new TextDecoder('utf-8', { fatal: true })

/** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
export const nonUtf8 = Symbol('<binary data, see result.original for the raw Uint8Array>')

/** Decode binary response data or mark it as non-UTF8 */
const tryDecode = (data: Uint8Array): string|Symbol => {
  try {
    return decoder.decode(data)
  } catch (e) {
    return nonUtf8
  }
}

function removeTrailingSlash (url: string) {
  while (url.endsWith('/')) { url = url.slice(0, url.length - 1) }
  return url
}

function setApi (agent: ScrtAgent, value: SecretJS.SecretNetworkClient|undefined) {
  Object.defineProperty(agent, 'api', {
    get () { return value },
    set (value: SecretJS.SecretNetworkClient|undefined) { setApi(agent, value) },
    enumerable: true,
    configurable: true
  })
  if (value && agent.wallet) {
    Object.assign(value, { wallet: agent.wallet })
  }
  if (value && agent.encryptionUtils) {
    Object.assign(value, { encryptionUtils: agent.encryptionUtils })
  }
}

function setWallet (agent: ScrtAgent, value: SecretJS.Wallet|undefined) {
  Object.defineProperty(agent, 'wallet', {
    get () { return value },
    set (value: SecretJS.Wallet|undefined) { setWallet(agent, value) },
    enumerable: true,
    configurable: true
  })
  if (agent.api) {
    Object.assign(agent.api, { wallet: value })
  }
}

function setEncryptionUtils (agent: ScrtAgent, value: SecretJS.EncryptionUtils|undefined) {
  Object.defineProperty(agent, 'encryptionUtils', {
    get () { return value },
    set (value: SecretJS.EncryptionUtils|undefined) { setEncryptionUtils(agent, value) },
    enumerable: true,
    configurable: true
  })
  if (agent.api) {
    Object.assign(agent.api, { encryptionUtils: value })
  }
}
