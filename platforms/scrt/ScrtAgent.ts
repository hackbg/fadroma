import Error from './ScrtError'
import Console from './ScrtConsole'
import Scrt from './ScrtChain'
import type ScrtBundle from './ScrtBundle'

import type * as SecretJS from 'secretjs'

import { Agent, Contract, assertAddress, assertChain, into } from '@fadroma/agent'
import type {
  Address, AgentClass, AgentOpts, Built, Uploaded,
  BundleClass, Client, CodeHash, ExecOpts, ICoin, Label, Message,
  Name, AnyContract
} from '@fadroma/agent'

import { base64, bip39, bip39EN } from '@hackbg/4mat'

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
  /** Set this to override the instance of the Enigma encryption utilities,
    * e.g. the one provided by Keplr. Since this is provided by Keplr on a
    * per-identity basis, this override is specific to each individual
    * ScrtGrpcAgent instance. */
  encryptionUtils: SecretJS.EncryptionUtils
}

/** Represents a connection to the Secret Network authenticated as a specific address. */
export default class ScrtAgent extends Agent {

  constructor (options: Partial<ScrtAgentOpts> = {}) {
    super(options)
    this.fees = options.fees ?? this.fees
    // Required: SecretJS.SecretNetworkClient instance
    if (!options.api) throw new Error.NoApi()
    this.api = options.api
    // Required: SecretJS.Wallet instance
    if (!options.wallet) throw new Error.NoWallet()
    this.wallet  = options.wallet
    this.address = this.wallet?.address
    // Optional: override api.encryptionUtils (e.g. with the ones from Keplr).
    // Redundant if agent is constructed with ScrtGrpc#getAgent
    // (which applies the override that the time of SecretNetworkClient construction)
    if (options.encryptionUtils) {
      Object.assign(this.api, { encryptionUtils: options.encryptionUtils })
    }
    // Optional: enable simulation to establish gas amounts
    this.simulate = options.simulate ?? this.simulate
  }

  get asyncInit (): Promise<this> {
    const init = new Promise<this>(async (resolve, reject)=>{
      try {
        // Use selected secretjs implementation
        const _SecretJS = this.chain.SecretJS
        // Unwrap base options
        let { name, address, mnemonic, wallet, fees, encryptionUtils } = this
        // Construct wallet from mnemonic if a wallet is not passed
        if (!wallet) {
          // Provide mnemonic from devnet
          if (name && this.chain.isDevnet && this.chain.node) {
            await this.chain.node.respawn()
            mnemonic = (await this.chain.node.getGenesisAccount(name)).mnemonic!
          }
          // Generate fresh mnemonic
          if (!mnemonic) {
            mnemonic = bip39.generateMnemonic(bip39EN)
            this.log.warnGeneratedMnemonic(mnemonic)
          }
          wallet = new _SecretJS.Wallet(mnemonic)
        } else if (mnemonic) {
          this.log.warnIgnoringMnemonic()
        }
        // Construct the API client
        let url = this.chain.url
        if (url.endsWith('/')) url = url.slice(0, url.length - 1)
        const api = await this.chain?.getApi({
          chainId:         this.chain.id,
          url:             url,
          wallet,
          walletAddress:   wallet.address || address,
          encryptionUtils
        })
        // If fees are not specified, get default fees from API.
        if (!fees) {
          fees = Scrt.defaultFees
          try {
            const max = Scrt.gas((await this.chain.fetchLimits()).gas)
            fees = { upload: max, init: max, exec: max, send: max }
          } catch (e) {
            this.log.warn(e)
            this.log.warnCouldNotFetchBlockLimit(Object.values(fees))
          }
        }
        // Done.
        resolve(this)
      } catch (e) {
        reject(e)
      }
    })
    Object.defineProperty(this, 'asyncInit', { get () { return init } })
    return init
  }

  declare chain: Scrt

  encryptionUtils?: SecretJS.EncryptionUtils

  fees = Scrt.defaultFees

  log = new Console('ScrtGrpcAgent')

  static Bundle: BundleClass<ScrtBundle>

  Bundle: BundleClass<ScrtBundle> = ScrtAgent.Bundle

  wallet: SecretJS.Wallet

  api: SecretJS.SecretNetworkClient

  simulate: boolean = false

  get account () {
    return this.api.query.auth.account({ address: assertAddress(this) })
  }

  get balance () {
    return this.getBalance(this.defaultDenom, assertAddress(this))
  }

  async getBalance (denom = this.defaultDenom, address: Address): Promise<string> {
    const response = await this.api.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async send (to: Address, amounts: ICoin[], opts?: any) {
    const from_address = assertAddress(this)
    const to_address = to
    const amount = amounts
    const msg = { from_address, to_address, amount }
    return this.api.tx.bank.send(msg, { gasLimit: opts?.gas?.gas })
  }

  async sendMany (outputs: never, opts: never) {
    throw new Error('ScrtAgent#sendMany: not implemented')
  }

  async getLabel (contract_address: string): Promise<string> {
    const response = await this.api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: string): Promise<string> {
    const response = await this.api.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getHash (arg: string|number): Promise<string> {
    if (typeof arg === 'number' || !isNaN(Number(arg))) {
      return (await this.api.query.compute.codeHashByCodeId({
        code_id: String(arg)
      })).code_hash!
    } else {
      return (await this.api.query.compute.codeHashByContractAddress({
        contract_address: arg
      })).code_hash!
    }
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    if (!this.address) throw new Error("No address")
    const failed = ()=>{
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    }
    const result = await this.api.query.auth.account({ address: this.address }) ?? failed()
    const { account_number, sequence } = result.account as any
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) throw new Error.NoCodeHash()
    const { encryptionUtils } = await this.api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }

  /** Query a Client.
    * @returns the result of the query */
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    return await this.api.query.compute.queryContract({
      contract_address: instance.address!,
      code_hash:        instance.codeHash,
      query: query as Record<string, unknown>
    }) as U
  }

  /** Upload a WASM binary. */
  async upload (data: Uint8Array): Promise<Uploaded> {

    type Log = { type: string, key: string }

    if (!this.address) throw new Error("No address")

    const result = await this.api.tx.compute.storeCode({
      sender: this.address,
      wasm_byte_code: data,
      source: "",
      builder: ""
    }, {
      gasLimit: Number(this.fees.upload?.amount[0].amount) || undefined
    })

    if (result.code !== 0) {
      this.log.warn(`Upload failed with result`, result)
      throw Object.assign(new Error.UploadFailed(), { result })
    }

    const codeId = result.arrayLog
      ?.find((log: Log) => log.type === "message" && log.key === "code_id")
      ?.value

    if (!codeId) {
      throw Object.assign(new Error.UploadFailed(), { noCodeId: true })
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
    if (!this.address) throw new Error("No address")
    const { chainId, codeId, codeHash, label, initMsg } = instance
    const code_id = Number(instance.codeId)
    if (isNaN(code_id)) throw new Error.CantInit_NoCodeId()
    if (!label) throw new Error.CantInit_NoLabel()
    if (!initMsg) throw new Error.CantInit_NoMessage()
    if (chainId && chainId !== assertChain(this).id) {
      throw new Error.WrongChain()
    }
    const result = await this.api.tx.compute.instantiateContract({
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
        simResult = await this.api.tx.compute.executeContract.simulate(tx, txOpts)
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
    const result = await this.api.tx.compute.executeContract(tx, txOpts)
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
