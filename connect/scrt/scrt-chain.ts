import {
  MsgExecuteContract,
  MsgInstantiateContract,
  ReadonlySigner,
  SecretNetworkClient,
  Wallet,
} from '@hackbg/secretjs-esm'
import type {
  CreateClientOptions,
  EncryptionUtils,
  TxResponse
} from '@hackbg/secretjs-esm'
import { Config, Error, Console } from './scrt-base'
import * as Mocknet from './scrt-mocknet'
import {
  Agent, into, base64, bip39, bip39EN, bold,
  Chain, Fee, Batch, assertChain,
  UploadedCode, ContractInstance,
  bindChainSupport
} from '@fadroma/agent'
import type {
  AgentClass, AgentFees, ChainClass, Uint128, BatchClass,
  ContractClient,
  ICoin, Message, Name, Address, TxHash, ChainId, CodeId, CodeHash, Label,
} from '@fadroma/agent'

/** Represents a Secret Network API endpoint. */
class ScrtChain extends Chain {

  /** Logger handle. */
  log = new Console('ScrtChain')

  /** Smallest unit of native token. */
  defaultDenom: string = ScrtChain.defaultDenom

  /** The Agent class used by this instance. */
  Agent: AgentClass<ScrtAgent> = ScrtChain.Agent

  /** A fresh instance of the anonymous read-only API client. Memoize yourself. */
  declare api?: SecretNetworkClient

  /** @returns a fresh instance of the anonymous read-only API client. */
  getApi (options: Partial<CreateClientOptions> = {}): SecretNetworkClient {
    options = { chainId: this.id, url: this.url, ...options }
    if (!options.url) throw new Error.Missing('api url')
    return new SecretNetworkClient(options as CreateClientOptions)
  }

  get block (): any {
    return this.ready.then(({api})=>api.query.tendermint.getLatestBlock({}))
  }

  get height () {
    return this.block.then((block: any)=>Number(block.block?.header?.height))
  }

  async getBalance (denom = this.defaultDenom, address: Address) {
    const {api} = await this.ready
    const response = await api.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async getLabel (contract_address: string): Promise<string> {
    const {api} = await this.ready
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: string): Promise<string> {
    const {api} = await this.ready
    const response = await api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getHash (arg: string|number): Promise<string> {
    const {api} = await this.ready
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

  async query <U> (
    instance: Address|Partial<ContractInstance>,
    message:  Message
  ): Promise<U> {
    throw new Error('TODO: Scrt#query: use same method on agent')
  }

  async fetchLimits (): Promise<{ gas: number }> {
    const {api} = await this.ready
    const params = { subspace: "baseapp", key: "BlockParams" }
    const { param } = await api.query.params.params(params)
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
    upload: this.gas(10000000),
    init:   this.gas(10000000),
    exec:   this.gas(1000000),
    send:   this.gas(1000000),
  }

  /** The default Config class for Secret Network. */
  static Config = Config

  /** The default Agent class for Secret Network. */
  static Agent: AgentClass<ScrtAgent> // set in index

  /** Connect to the Secret Network Mainnet. */
  static mainnet = (
    options: Partial<ScrtChain> = {},
    config = new Config()
  ): ScrtChain => super.mainnet({
    id:  config.mainnetChainId,
    url: config.mainnetUrl,
    ...options||{},
  }) as ScrtChain

  /** Connect to the Secret Network Testnet. */
  static testnet = (
    options: Partial<ScrtChain> = {},
    config = new Config()
  ): ScrtChain => super.testnet({
    id:  config.testnetChainId,
    url: config.testnetUrl,
    ...options||{},
  }) as ScrtChain

  /** Connect to Secret Network in testnet mode. */
  static devnet = (options: Partial<ScrtChain> = {}): ScrtChain => {
    throw new Error('Devnet not installed. Import @hackbg/fadroma')
  }

  /** Connect to a Secret Network mocknet. */
  static mocknet = (options: Partial<Mocknet.Chain> = {}): Mocknet.Chain => new Mocknet.Chain({
    id: 'mocknet',
    ...options
  })

}

export type { TxResponse }

/** Represents a connection to the Secret Network,
  * authenticated as a specific address. */
class ScrtAgent extends Agent {

  log = new Console('ScrtAgent')

  /** Downcast chain property to Scrt only. */
  declare chain: ScrtChain

  /** Batch class used by this agent. */
  Batch: BatchClass<ScrtBatch> = ScrtAgent.Batch

  /** Whether to simulate each execution first to get a more accurate gas estimate. */
  simulateForGas: boolean = false

  /** Default fees for this agent. */
  fees = ScrtChain.defaultFees

  constructor (options: Partial<ScrtAgent> = {}) {
    super(options)
    this.fees            = options.fees ?? this.fees
    this.api             = options.api
    this.wallet          = options.wallet
    this.address         = this.wallet?.address
    this.mnemonic        = options.mnemonic ?? this.mnemonic
    this.encryptionUtils = options.encryptionUtils
    this.simulateForGas  = options.simulateForGas ?? this.simulateForGas
    this.log.label = `${this.address??'(no address)'} @ ${this.chain?.id??'(no chain id)'}`
  }

  async getApi (): Promise<this & {
    address: Address
    api:     SecretNetworkClient,
    wallet:  Wallet,
  }> {
    if (!this.wallet || this.wallet instanceof ReadonlySigner) {
      // If this is a named devnet agent
      if (this.name && this.chain.isDevnet && this.chain.devnet) {
        // Provide mnemonic from devnet genesis accounts
        await this.chain.devnet.start()
        const account = await this.chain.devnet.getAccount(this.name)
        this.mnemonic = account.mnemonic!
      }
      // If there is still no mnemonic
      if (!this.mnemonic) {
        // Generate fresh mnemonic
        this.mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.generatedMnemonic(this.mnemonic!)
      }
      this.wallet = new Wallet(this.mnemonic)
    } else if (this.mnemonic) {
      this.log.ignoringMnemonic()
    }

    // Construct the API client
    this.api = await this.chain.getApi({
      chainId:         this.chain.id,
      url:             this.chain.url && removeTrailingSlash(this.chain.url),
      wallet:          this.wallet,
      walletAddress:   this.wallet?.address || this.address,
      encryptionUtils: this.encryptionUtils
    })

    // Optional: override api.encryptionUtils (e.g. with the ones from Keplr).
    if (this.encryptionUtils) {
      Object.assign(this.api, {
        encryptionUtils: this.encryptionUtils
      })
    }

    // If fees are not specified, get default fees from API.
    if (!this.fees) {
      this.fees = ScrtChain.defaultFees
      try {
        const max = ScrtChain.gas((await this.chain.fetchLimits()).gas)
        this.fees = { upload: max, init: max, exec: max, send: max }
      } catch (e) {
        this.log.warn(e)
        this.log.defaultGas(Object.values(this.fees))
      }
    }

    // Override address and set name if missing.
    this.address = this.wallet.address
    this.name ??= this.address
    this.log.label = `${this.address??'(no address)'} @ ${this.chain.id??'(no chain id)'}`
    this.log.log('authenticated')

    return this as this & {
      address: Address,
      api:     SecretNetworkClient,
      wallet:  Wallet
    }
  }

  /** Instance of the underlying platform API provided by `secretjs`. */
  get api (): SecretNetworkClient|undefined {
    return undefined
  }
  set api (value: SecretNetworkClient|undefined) {
    this.setApi(value)
  }
  protected setApi (value: SecretNetworkClient|undefined) {
    Object.defineProperty(this, 'api', {
      get () { return value },
      set (value: SecretNetworkClient|undefined) { this.setApi(this, value) },
      enumerable: true,
      configurable: true
    })
    if (value && this.wallet) {
      Object.assign(value, { wallet: this.wallet })
    }
    if (value && this.encryptionUtils) {
      Object.assign(value, { encryptionUtils: this.encryptionUtils })
    }
  }

  /** This agent's identity on the chain. */
  get wallet (): Wallet|undefined {
    return (this.api as any)?.wallet
  }
  set wallet (value: Wallet|undefined) {
    this.setWallet(value)
  }
  protected setWallet (value: Wallet|undefined) {
    Object.defineProperty(this, 'wallet', {
      get () { return value },
      set (value: Wallet|undefined) { this.setWallet(this, value) },
      enumerable: true,
      configurable: true
    })
    if (this.api) {
      Object.assign(this.api, { wallet: value })
    }
  }

  /** Provide this to allow SecretJS to sign with keys stored in Keplr. */
  get encryptionUtils (): EncryptionUtils|undefined {
    return (this.api as any)?.encryptionUtils
  }
  set encryptionUtils (value: EncryptionUtils|undefined) {
    this.setEncryptionUtils(value)
  }
  protected setEncryptionUtils (value: EncryptionUtils|undefined) {
    Object.defineProperty(this, 'encryptionUtils', {
      get () { return value },
      set (value: EncryptionUtils|undefined) { this.setEncryptionUtils(value) },
      enumerable: true,
      configurable: true
    })
    if (this.api) {
      Object.assign(this.api, { encryptionUtils: value })
    }
  }

  get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
    return this.ready.then(({ api, address })=>{
      return api!.query.auth.account({ address })
    })
  }

  get balance () {
    return this.ready.then(()=>this.getBalance(this.defaultDenom, this.address!))
  }

  async getBalance (denom = this.defaultDenom, address: Address): Promise<string> {
    const { api } = await this.ready
    const response = await api!.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async send (to: Address, amounts: ICoin[], opts?: any) {
    const { api } = await this.ready
    const from_address = this.address!
    const to_address = to
    const amount = amounts
    const msg = { from_address, to_address, amount }
    return api!.tx.bank.send(msg, { gasLimit: opts?.gas?.gas })
  }

  async sendMany (outputs: never, opts: never) {
    throw new Error('ScrtAgent#sendMany: not implemented')
  }

  async getLabel (contract_address: string): Promise<string> {
    const { api } = await this.ready
    const response = await api!.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: string): Promise<string> {
    const { api } = await this.ready
    const response = await api!.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getHash (arg: string|number): Promise<string> {
    const { api } = await this.ready
    if (typeof arg === 'number' || !isNaN(Number(arg))) {
      return (await api!.query.compute.codeHashByCodeId({
        code_id: String(arg)
      })).code_hash!
    } else {
      return (await api!.query.compute.codeHashByContractAddress({
        contract_address: arg
      })).code_hash!
    }
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const { api, address } = await this.ready
    const result = await api!.query.auth.account({ address: this.address }) ?? (() => {
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    })
    const { account_number, sequence } = result.account as any
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) throw new Error.Missing.CodeHash()
    const { api } = await this.ready
    const { encryptionUtils } = await this.api! as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }

  /** Query a Client.
    * @returns the result of the query */
  async query <U> (
    contract: Address|Partial<ContractInstance>,
    query:    Message
  ): Promise<U> {
    const { api } = await this.ready
    if (typeof contract === 'string') {
      contract = new ContractInstance({ address: contract })
    }
    return await api!.query.compute.queryContract({
      contract_address: contract.address!,
      code_hash:        contract.codeHash,
      query: query as Record<string, unknown>
    }) as U
  }

  /** Upload a WASM binary. */
  protected async doUpload (data: Uint8Array): Promise<Partial<UploadedCode>> {
    const { api, address } = await this.ready
    const request  = { sender: address!, wasm_byte_code: data, source: "", builder: "" }
    const gasLimit = Number(this.fees.upload?.amount[0].amount) || undefined
    const result   = await api!.tx.compute.storeCode(request, { gasLimit }).catch(error=>error)
    const { code, message, details = [], rawLog } = result
    if (code !== 0) {
      this.log.error(`Upload failed with code ${bold(code)}:`, bold(message ?? rawLog ?? ''), ...details)
      if (message === `account ${this.address} not found`) {
        this.log.info(`If this is a new account, send it some ${this.defaultDenom} first.`)
        if (this.chain.isMainnet) {
          this.log.info(`Mainnet fee grant faucet:`, bold(`https://faucet.secretsaturn.net/`))
        }
        if (this.chain.isTestnet) {
          this.log.info(`Testnet faucet:`, bold(`https://faucet.pulsar.scrttestnet.com/`))
        }
      }
      throw new Error.Failed.Upload(result)
    }
    type Log = { type: string, key: string }
    const codeId = result.arrayLog
      ?.find((log: Log) => log.type === "message" && log.key === "code_id")
      ?.value
    if (!codeId) {
      this.log.error(`Code id not found in result.`)
      throw new Error.Failed.Upload({ ...result, noCodeId: true })
    }
    return {
      chainId:  this.chain.id,
      codeId,
      codeHash: await this.getHash(Number(codeId)),
      uploadBy: this.address,
      uploadTx: result.transactionHash,
      uploadGas: result.gasUsed
    }
  }

  protected async doInstantiate (
    codeId: CodeId,
    options: Parameters<Agent["doInstantiate"]>[1]
  ): Promise<Partial<ContractInstance>> {
    const { api } = await this.ready
    if (!this.address) throw new Error("Agent has no address")

    const parameters = {
      sender:     this.address,
      code_id:    Number(codeId),
      code_hash:  options.codeHash,
      label:      options.label,
      init_msg:   options.initMsg,
      init_funds: options.initFunds,
      memo:       options.initMemo
    }

    const result = await api!.tx.compute.instantiateContract(parameters, {
      gasLimit: Number(this.fees.init?.amount[0].amount) || undefined
    })

    if (result.code !== 0) {
      this.log.error('Init failed:', { parameters, result })
      throw Object.assign(new Error.Failed.Init(codeId), { parameters, result })
    }

    type Log = { type: string, key: string }
    const address = result.arrayLog!
      .find((log: Log) => log.type === "message" && log.key === "contract_address")
      ?.value!

    return {
      chainId:  this.chain.id,
      address,
      codeHash: options.codeHash,
      initBy:   this.address,
      initTx:   result.transactionHash,
      initGas:  result.gasUsed,
      label:    options.label,
    }
  }

  protected async doExecute (
    contract: { address: Address, codeHash: CodeHash },
    message:  Message,
    options?: Parameters<Agent["doExecute"]>[2]
  ): Promise<TxResponse> {
    const { api, address } = await this.ready
    const tx = {
      sender:           address!,
      contract_address: contract.address,
      code_hash:        contract.codeHash,
      msg:              message as Record<string, unknown>,
      sentFunds:        options?.execSend
    }
    const txOpts = {
      gasLimit: Number(options?.execFee?.gas) || undefined
    }
    if (this.simulateForGas) {
      this.log.info('Simulating transaction...')
      let simResult
      try {
        simResult = await api!.tx.compute.executeContract.simulate(tx, txOpts)
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
    const result = await api!.tx.compute.executeContract(tx, txOpts)
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

  static Batch: BatchClass<ScrtBatch> // populated in index

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

export interface ScrtBatchClass <B extends ScrtBatch> {
  new (agent: ScrtAgent): B
}

export interface ScrtBatchResult {
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
class ScrtBatch extends Batch {

  /** Logger handle. */
  log = new Console('ScrtBatch')

  static batchCounter: number = 0

  /** The agent which will sign and/or broadcast the batch. */
  declare agent: ScrtAgent

  constructor (agent: ScrtAgent, callback?: (batch: ScrtBatch)=>unknown) {
    super(agent, callback as (batch: Batch)=>unknown)
  }

  /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
    * unsigned transaction batch; don't execute it, but save it in
    * `state/$CHAIN_ID/transactions` and output a signing command for it to the console. */
  async save (name?: string) {
    await super.save(name)
    // Number of batch, just for identification in console
    const N = ++ScrtBatch.batchCounter
    name ??= name || `TX.${N}.${+new Date()}`
    // Get signer's account number and sequence via the canonical API
    const { accountNumber, sequence } = await this.agent.getNonce()//this.chain.url, this.agent.address)
    // Print the body of the batch
    this.log.batchMessages(this.msgs, N)
    // The base Batch class stores messages as (immediately resolved) promises
    const messages = await Promise.all(this.msgs.map(({init, exec})=>{
      // Encrypt init message
      if (init) return this.encryptInit(init)
      // Encrypt exec/handle message
      if (exec) return this.encryptExec(exec)
      // Anything in the messages array that does not have init or exec key is ignored
    }))
    // Print the body of the batch
    this.log.batchMessagesEncrypted(messages, N)
    // Compose the plaintext
    const unsigned = this.composeUnsignedTx(messages, name)
    // Output signing instructions to the console
    new Console(this.log.label).batchSigningCommand(
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

  async submit (memo = ""): Promise<ScrtBatchResult[]> {
    await super.submit(memo)
    const chainId = assertChain(this).id
    const results: ScrtBatchResult[] = []
    const msgs  = this.conformedMsgs
    const limit = Number(ScrtChain.defaultFees.exec?.amount[0].amount) || undefined
    const gas   = msgs.length * (limit || 0)
    try {
      const agent = this.agent as unknown as ScrtAgent
      await agent.ready
      const txResult = await agent.api!.tx.broadcast(msgs as any, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      for (const i in msgs) {
        const msg = msgs[i]
        const result: Partial<ScrtBatchResult> = {}
        result.sender  = this.address
        result.tx      = txResult.transactionHash
        result.chainId = chainId
        if (msg instanceof MsgInstantiateContract) {
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
        if (msg instanceof MsgExecuteContract) {
          result.type    = 'wasm/MsgExecuteContract'
          result.address = msg.contractAddress
        }
        results[Number(i)] = result as ScrtBatchResult
      }
    } catch (err) {
      new Console(this.log.label)
        .submittingBatchFailed(err as Error)
      throw err
    }
    return results
  }

  async simulateForGas () {
    const { api } = await this.agent.ready
    const msgs = this.conformedMsgs
    return await api!.tx.simulate(msgs as any)
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  private get conformedMsgs () {
    const msgs = this.assertMessages().map(({init, exec}={})=>{
      if (init) return new MsgInstantiateContract({
        sender:          init.sender,
        code_id:         init.codeId,
        code_hash:       init.codeHash,
        label:           init.label,
        init_msg:        init.msg,
        init_funds:      init.funds,
      })
      if (exec) return new MsgExecuteContract({
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

bindChainSupport(ScrtChain, ScrtAgent, ScrtBatch)

export { ScrtChain as Chain, ScrtAgent as Agent, ScrtBatch as Batch }
