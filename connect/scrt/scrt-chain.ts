import * as SecretJS from 'secretjs'
import { Config, Error, Console } from './scrt-base'
import {
  Agent, Contract, assertAddress, into, base64, bip39, bip39EN, bold,
  Chain, Fee, Mocknet, Bundle, assertChain
} from '@fadroma/agent'
import type {
  AgentClass, AgentOpts, Built, Uploaded, AgentFees, ChainClass, Uint128, BundleClass, Client,
  ExecOpts, ICoin, Message, Name, AnyContract, Address, TxHash, ChainId, CodeId, CodeHash, Label,
  Instantiated
} from '@fadroma/agent'

/** Represents a Secret Network API endpoint. */
class ScrtChain extends Chain {
  /** The default SecretJS module. */
  static SecretJS: typeof SecretJS

  log = new Console('Scrt')
  /** Smallest unit of native token. */
  defaultDenom: string = ScrtChain.defaultDenom
  /** The SecretJS module used by this instance.
    * You can set this to a compatible version of the SecretJS module
    * in order to use it instead of the one bundled with this package.
    * This setting is per-chain:,all ScrtAgent instances
    * constructed by the configured Scrt instance's getAgent method
    * will use the non-default SecretJS module. */
  SecretJS = ScrtChain.SecretJS
  /** The Agent class used by this instance. */
  Agent: AgentClass<ScrtAgent> = ScrtChain.Agent

  constructor (options: Partial<ScrtChain> = {
    url:  ScrtChain.Config.defaultMainnetUrl,
    mode: Chain.Mode.Mainnet
  }) {
    super(options)
    this.log.label = `${this.id}`
    // Optional: Allow a different API-compatible version of SecretJS to be passed
    this.SecretJS = options.SecretJS ?? this.SecretJS
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** A fresh instance of the anonymous read-only API client. Memoize yourself. */
  get api () {
    return this.getApi()
  }
  get block () {
    return this.api.then(api=>api.query.tendermint.getLatestBlock({}))
  }
  get height () {
    return this.block.then(block=>Number(block.block?.header?.height))
  }
  async getBalance (denom = this.defaultDenom, address: Address) {
    const api = await this.api
    const response = await api.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }
  async getLabel (contract_address: string): Promise<string> {
    const api = await this.api
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }
  async getCodeId (contract_address: string): Promise<string> {
    const api = await this.api
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }
  async getHash (arg: string|number): Promise<string> {
    const api = await this.api
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
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    throw new Error('TODO: Scrt#query: use same method on agent')
  }
  /** @returns a fresh instance of the anonymous read-only API client. */
  async getApi (
    options: Partial<SecretJS.CreateClientOptions> = {}
  ): Promise<SecretJS.SecretNetworkClient> {
    options = { chainId: this.id, url: this.url, ...options }
    if (!options.url) throw new Error.NoApiUrl()
    return await new (this.SecretJS.SecretNetworkClient)(options as SecretJS.CreateClientOptions)
  }
  async fetchLimits (): Promise<{ gas: number }> {
    const params = { subspace: "baseapp", key: "BlockParams" }
    const { param } = await (await this.api).query.params.params(params)
    let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
    this.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
    if (max_gas < 0) {
      max_gas = 10000000
      this.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
    }
    return { gas: max_gas }
  }

  /** Smallest unit of native token. */
  static defaultDenom: string = 'uscrt'
  /** @returns Fee in uscrt */
  static gas = (amount: Uint128|number) =>
    new Fee(amount, this.defaultDenom)
  /** Set permissive fees by default. */
  static defaultFees: AgentFees = {
    upload: this.gas(2000000),
    init:   this.gas(2000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }
  /** The default Config class for Secret Network. */
  static Config = Config
  /** The default Agent class for Secret Network. */
  static Agent: AgentClass<ScrtAgent> // set in index
  /** Connect to the Secret Network Mainnet. */
  static mainnet = (options: Partial<ScrtChain> = {}): ScrtChain => super.mainnet({
    id:  ScrtChain.Config.defaultMainnetChainId,
    url: ScrtChain.Config.defaultMainnetUrl,
    ...options||{},
  }) as ScrtChain
  /** Connect to the Secret Network Testnet. */
  static testnet = (options: Partial<ScrtChain> = {}): ScrtChain => super.testnet({
    id:  ScrtChain.Config.defaultTestnetChainId,
    url: ScrtChain.Config.defaultTestnetUrl,
    ...options||{},
  }) as ScrtChain
  /** Connect to a Secret Network devnet. */
  static devnet = (options: Partial<ScrtChain> = {}): ScrtChain => super.devnet({
    ...options||{},
  }) as ScrtChain
  /** Create to a Secret Network mocknet. */
  static mocknet = (options: Partial<Mocknet.Chain> = {}): Mocknet.Chain => super.mocknet({
    id: 'scrt-mocknet',
    ...options||{}
  })

}

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
class ScrtAgent extends Agent {
  log = new Console('ScrtAgent')
  /** Downcast chain property to Scrt only. */
  declare chain: ScrtChain
  /** Bundle class used by this agent. */
  Bundle: BundleClass<ScrtBundle> = ScrtAgent.Bundle
  /** Whether transactions should be simulated instead of executed. */
  simulate: boolean = false
  /** Default fees for this agent. */
  fees = ScrtChain.defaultFees

  constructor (options: Partial<ScrtAgentOpts> = {}) {
    super(options)
    this.fees            = options.fees ?? this.fees
    this.api             = options.api
    this.wallet          = options.wallet
    this.address         = this.wallet?.address
    this.mnemonic        = options.mnemonic ?? this.mnemonic
    this.encryptionUtils = options.encryptionUtils
    this.simulate        = options.simulate ?? this.simulate
    this.log.label = `${this.address??'(no address)'}@${this.chain?.id??'(no chain id)'}`
  }

  get ready (): Promise<this & { api: SecretJS.SecretNetworkClient }> {
    if (!this.chain) throw new Error.Missing.Chain()
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
            this.log.warn.generatedMnemonic(this.mnemonic!)
          }
          wallet = new _SecretJS.Wallet(this.mnemonic)
        } else if (this.mnemonic) {
          this.log.warn.ignoringMnemonic()
        }
        // Construct the API client
        const url = this.chain.url && removeTrailingSlash(this.chain.url)
        const chainId = this.chain.id
        const walletAddress = wallet?.address || this.address
        const { encryptionUtils } = this
        const apiOptions = { chainId, url, wallet, walletAddress, encryptionUtils }
        this.api = await this.chain.getApi(apiOptions)
        // Optional: override api.encryptionUtils (e.g. with the ones from Keplr).
        if (encryptionUtils) Object.assign(this.api, { encryptionUtils })
        // If fees are not specified, get default fees from API.
        if (!this.fees) {
          this.fees = ScrtChain.defaultFees
          try {
            const max = ScrtChain.gas((await this.chain.fetchLimits()).gas)
            this.fees = { upload: max, init: max, exec: max, send: max }
          } catch (e) {
            this.log.warn(e)
            this.log.warn.defaultGas(Object.values(this.fees))
          }
        }
        // Override address and set name if missing.
        this.address = wallet.address
        this.name ??= this.address
        this.log.label = `${this.address??'(no address)'}@${this.chain.id??'(no chain id)'}`
        this.log.log('authenticated')
        // Done.
        resolve(this as this & { api: SecretJS.SecretNetworkClient })
      } catch (e) {
        reject(e)
      }
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

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
    if (!this.address) throw new Error.NoAddress()
    const request  = { sender: this.address, wasm_byte_code: data, source: "", builder: "" }
    const gasLimit = Number(this.fees.upload?.amount[0].amount) || undefined
    const result   = await api.tx.compute.storeCode(request, { gasLimit }).catch(error=>error)
    const { code, message, details = [], rawLog } = result
    if (code !== 0) {
      this.log.error(`Upload failed with code ${bold(code)}:`, bold(message ?? rawLog ?? ''), ...details)
      if (message === `account ${this.address} not found`) {
        this.log.info(`If this is a new account, send it some ${this.defaultDenom} first.`)
        if (this.chain.isMainnet) {
          this.log.info(`Mainnet fee grant faucet:`, bold(`https://faucet.secretsaturn.net/`))
        }
        if (this.chain.isTestnet) {
          this.log.info(`Testnet faucet:`, bold(`https://faucet.starshell.net/`))
        }
      }
      throw new Error.Failed.Upload(result)
    }
    const codeId = result.arrayLog
      ?.find((log: Log) => log.type === "message" && log.key === "code_id")
      ?.value
    if (!codeId) {
      this.log.error(`Code id not found in result.`)
      throw new Error.Failed.Upload({ ...result, noCodeId: true })
    }
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
    if (!this.address) throw new Error("Agent has no address")
    if (instance.address) {
      this.log.warn("Instance already has address, not instantiating.")
      return instance as Instantiated
    }
    const { chainId, codeId, codeHash, label, initMsg } = instance
    const code_id = Number(instance.codeId)
    if (isNaN(code_id)) throw new Error.CantInit.NoCodeId()
    if (!label) throw new Error.CantInit.NoLabel()
    if (!initMsg) throw new Error.CantInit.NoMessage()
    if (chainId && chainId !== assertChain(this).id) throw new Error.WrongChain()
    const parameters = {
      sender:    this.address,
      code_id,
      code_hash: codeHash!,
      init_msg:  await into(initMsg),
      label,
      init_funds
    }
    const gasLimit = Number(this.fees.init?.amount[0].amount) || undefined
    const result = await api.tx.compute.instantiateContract(parameters, { gasLimit })
    if (result.code !== 0) {
      this.log.error('Init failed:', { initMsg, result })
      throw Object.assign(new Error.Failed.Init(code_id), { result })
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
    if (memo) this.log.warn.noMemos()
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
    if (result.code !== 0) throw this.decryptError(result)
    return result as TxResponse
  }

  decryptError (result: TxResponse) {
    const error = `ScrtAgent#execute: gRPC error ${result.code}: ${result.rawLog}`
    // make the original result available on request
    const original = structuredClone(result)
    Object.defineProperty(result, "original", { enumerable: false, get () { return original } })
    // decode the values in the result
    const txBytes = tryDecode(result.tx as Uint8Array)
    Object.assign(result, { txBytes })
    for (const i in result.tx.signatures) {
      Object.assign(result.tx.signatures, { [i]: tryDecode(result.tx.signatures[i as any]) })
    }
    for (const event of result.events) {
      for (const attr of event?.attributes ?? []) {
        //@ts-ignore
        try { attr.key   = tryDecode(attr.key)   } catch (e) {}
        //@ts-ignore
        try { attr.value = tryDecode(attr.value) } catch (e) {}
      }
    }
    return Object.assign(new Error(error), result)
  }

  static Bundle: BundleClass<ScrtBundle> // populated in index

}

/** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
const decoder = new TextDecoder('utf-8', { fatal: true })

/** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
export const nonUtf8 = Symbol('(binary data, see result.original for the raw Uint8Array)')

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

export interface ScrtBundleClass <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

export interface ScrtBundleResult {
  sender?:   Address
  tx:        TxHash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
  address?:  Address
  label?:    Label
}

/** Base class for transaction-bundling Agent for both Secret Network implementations. */
class ScrtBundle extends Bundle {

  static bundleCounter: number = 0

  /** The agent which will sign and/or broadcast the bundle. */
  declare agent: ScrtAgent

  constructor (agent: ScrtAgent, callback?: (bundle: ScrtBundle)=>unknown) {
    super(agent, callback as (bundle: Bundle)=>unknown)
    // Optional: override SecretJS implementation
    Object.defineProperty(this, 'SecretJS', { enumerable: false, writable: true })
  }

  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction bundle; don't execute it, but save it in
    * `state/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    await super.save(name)
    // Number of bundle, just for identification in console
    const N = ++ScrtBundle.bundleCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the bundle
    this.log.bundleMessages(this.msgs, N)
    // The base Bundle class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptExec(exec)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the bundle
    this.log.bundleMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages, name)
    // Output signing instructions to the console
    new Console(this.log.label).bundleSigningCommand(
      String(Math.floor(+ new Date()/1000)),
      this.agent.address!, assertChain(this.agent).id,
      accountNumber, sequence, unsigned
    )
    return { N, name, accountNumber, sequence, unsignedTxBody: JSON.stringify(unsigned) }
  }

  private async encryptInit (init: any): Promise<any> {
    const encrypted = await this.agent.encrypt(init.codeHash, init.msg)
    return {
      "@type":            "/secret.compute.v1beta1.MsgInstantiateContract",
      callback_code_hash: '',
      callback_sig:       null,
      sender:             init.sender,
      code_id:     String(init.codeId),
      init_funds:         init.funds,
      label:              init.label,
      init_msg:           encrypted,
    }
  }

  private async encryptExec (exec: any): Promise<any> {
    const encrypted = await this.agent.encrypt(exec.codeHash, exec.msg)
    return {
      "@type":            '/secret.compute.v1beta1.MsgExecuteContract',
      callback_code_hash: '',
      callback_sig:       null,
      sender:             exec.sender,
      contract:           exec.contract,
      sent_funds:         exec.funds,
      msg:                encrypted,
    }
  }

  private composeUnsignedTx (encryptedMessages: any[], memo?: string): any {
    const fee = ScrtChain.gas(10000000)
    const gas = fee.gas
    const payer = ""
    const granter = ""
    const auth_info = { signer_infos: [], fee: { ...fee, gas, payer, granter }, }
    const signatures: any[] = []
    const body = {
      memo,
      messages:                       encryptedMessages,
      timeout_height:                 "0",
      extension_options:              [],
      non_critical_extension_options: []
    }
    return { auth_info, signatures, body }
  }

  async submit (memo = ""): Promise<ScrtBundleResult[]> {
    await super.submit(memo)
    const SecretJS = (this.agent?.chain as ScrtChain).SecretJS
    const chainId = assertChain(this).id
    const results: ScrtBundleResult[] = []
    const msgs  = this.conformedMsgs
    const limit = Number(ScrtChain.defaultFees.exec?.amount[0].amount) || undefined
    const gas   = msgs.length * (limit || 0)
    try {
      const agent = this.agent as unknown as ScrtAgent
      await agent.ready
      const txResult = await agent.api!.tx.broadcast(msgs as any, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in bundle): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBundleResult> = {}
        result.sender  = this.address
        result.tx      = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof SecretJS.MsgInstantiateContract) {
          type Log = { msg: number, type: string, key: string }
          const findAddr = ({msg, type, key}: Log) =>
            msg  ==  Number(i) &&
            type === "message" &&
            key  === "contract_address"
          result.type    = 'wasm/MsgInstantiateContract'
          result.codeId  = msg.codeId
          result.label   = msg.label
          result.address = txResult.arrayLog?.find(findAddr)?.value
        }
        if (msg instanceof SecretJS.MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBundleResult
      }
    } catch (err) {
      new Console(this.log.label)
        .submittingBundleFailed(err as Error)
      throw err
    }
    return results
  }

  async simulate () {
    const { api } = await this.agent.ready
    const msgs = this.conformedMsgs
    return await api!.tx.simulate(msgs as any)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    const SecretJS = (this.agent.chain as ScrtChain).SecretJS
    const msgs = this.assertMessages().map(({init, exec}={})=>{
      if (init) return new SecretJS.MsgInstantiateContract({
        sender:          init.sender,
        code_id:         init.codeId,
        code_hash:       init.codeHash,
        label:           init.label,
        init_msg:        init.msg,
        init_funds:      init.funds,
      })
      if (exec) return new SecretJS.MsgExecuteContract({
        sender:           exec.sender,
        contract_address: exec.contract,
        code_hash:        exec.codeHash,
        msg:              exec.msg,
        sent_funds:       exec.funds,
      })
    })
    return msgs
  }

}

Object.assign(ScrtChain, { SecretJS, Agent: Object.assign(ScrtAgent, { Bundle: ScrtBundle }) })

export {
  ScrtChain as Chain,
  ScrtAgent as Agent,
  ScrtBundle as Bundle,
}
