import type * as SecretJS from 'secretjs'
import { base64 } from '@hackbg/4mat'
import type {
  Address, AgentClass, AgentOpts,
  BundleClass, Client, CodeHash, ExecOpts, ICoin, Label, Message,
} from '@fadroma/core'
import { Agent, Contract, assertAddress, assertChain } from '@fadroma/core'
import { Scrt } from './scrt'
import { ScrtError as Error, ScrtConsole as Console } from './scrt-events'
import type { ScrtBundle } from './scrt-bundle'

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
export class ScrtAgent extends Agent {

  static Bundle: BundleClass<ScrtBundle>

  fees = Scrt.defaultFees

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

  log = new Console('ScrtGrpcAgent')

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

  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    const { address: contractAddress, codeHash } = instance
    const args = { contractAddress, codeHash, query: query as Record<string, unknown> }
    // @ts-ignore
    return await this.api.query.compute.queryContract(args) as U
  }

  async upload (data: Uint8Array): Promise<Contract<any>> {
    type Log = { type: string, key: string }
    if (!this.address) throw new Error("No address")
    const sender     = this.address
    const args       = { sender, wasm_byte_code: data, source: "", builder: "" }
    const gasLimit   = Number(Scrt.defaultFees.upload.amount[0].amount)
    const result     = await this.api.tx.compute.storeCode(args, { gasLimit })
    const findCodeId = (log: Log) => log.type === "message" && log.key === "code_id"
    const codeId     = result.arrayLog?.find(findCodeId)?.value
    const codeHash   = await this.getHash(Number(codeId))
    const chainId    = assertChain(this).id
    const contract   = new Contract({
      agent: this,
      codeHash,
      chainId,
      codeId,
      uploadTx: result.transactionHash
    })
    return contract
  }

  async instantiate (
    template: Contract<any>,
    label:    Label,
    init_msg: Message,
    init_funds = []
  ): Promise<Contract<any>> {
    if (!this.address) throw new Error("No address")
    const { chainId, codeId, codeHash } = template
    const code_id = Number(template.codeId)
    if (chainId && chainId !== assertChain(this).id) throw new Error.WrongChain()
    if (isNaN(code_id)) throw new Error.NoCodeId()
    const sender = this.address
    const args = { sender, code_id, code_hash: codeHash!, init_msg, label, init_funds }
    const gasLimit = Number(Scrt.defaultFees.init.amount[0].amount)
    const result   = await this.api.tx.compute.instantiateContract(args, { gasLimit })
    if (!result.arrayLog) {
      throw Object.assign(
        new Error(`SecretRPCAgent#instantiate: ${result.rawLog}`), {
          jsonLog: result.jsonLog
        }
      )
    }
    type Log = { type: string, key: string }
    const findAddr = (log: Log) => log.type === "message" && log.key === "contract_address"
    const address  = result.arrayLog.find(findAddr)?.value!
    const initTx   = result.transactionHash
    return Object.assign(template, { address })
  }

  async instantiateMany (template: Contract<any>, configs: DeployArgs[]) {
    // instantiate multiple contracts in a bundle:
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(template, configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const instance = instances[i]
      if (instance) {
        instance.codeId   = template.codeId
        instance.codeHash = template.codeHash
        instance.label    = configs[i][0]
      }
    }
    return instances
  }

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
      gasLimit: Number(fee.gas)
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
