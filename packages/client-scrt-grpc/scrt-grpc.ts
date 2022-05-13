import {
  AgentOptions,
  Template,
  Instance,
  ScrtChain,
  ScrtAgent,
  ScrtGas,
  ScrtBundle,
} from '@fadroma/client-scrt'
import {
  SecretNetworkClient,
  Wallet,
  MsgInstantiateContract,
  MsgExecuteContract,
  Tx,
} from 'secretjs'

import * as constants from './scrt-grpc-constants'

export interface ScrtRPCAgentOptions extends AgentOptions {
  wallet?:  Wallet
  url?:     string
  api?:     SecretNetworkClient
  keyPair?: unknown
}

export class ScrtRPCAgent extends ScrtAgent {

  Bundle = ScrtRPCBundle

  static async create (
    chain:   Scrt,
    options: ScrtRPCAgentOptions
  ): Promise<ScrtRPCAgent> {
    const {
      mnemonic,
      wallet = new Wallet(mnemonic),
      keyPair,
      address
    } = options
    if (!mnemonic) {
      throw new Error(constants.ERR_ONLY_FROM_MNEMONIC)
    }
    if (keyPair) {
      console.warn(constants.WARN_IGNORING_KEY_PAIR)
      delete options.keyPair
    }
    if (address && address !== wallet.address) {
      throw new Error(constants.ERR_EXPECTED_WRONG_ADDRESS)
    }
    const api = await SecretNetworkClient.create({
      chainId:       chain.id,
      grpcWebUrl:    chain.url || "https://grpc-web.azure-api.net",
      wallet:        wallet,
      walletAddress: wallet.address,
    })
    return new ScrtRPCAgent(chain, { ...options, wallet, api })
  }

  constructor (chain: Scrt, options: ScrtRPCAgentOptions) {
    // @ts-ignore
    super(chain, options)
    this.wallet  = options.wallet
    this.api     = options.api
    this.address = this.wallet?.address
  }

  wallet: Wallet

  api:    SecretNetworkClient

  defaultDenomination = 'uscrt'

  address: string

  get block () {
    return this.api.query.tendermint.getLatestBlock({})
  }

  get account () {
    return this.api.query.auth.account({ address: this.address })
  }

  get balance () {
    return this.getBalance(this.defaultDenomination)
  }

  async getBalance (denom = this.defaultDenomination) {
    const response = await this.api.query.bank.balance({ address: this.address, denom })
    return response.balance.amount
  }

  async send (...args: any[]) {
    throw new Error('ScrtRPCAgent#send: not implemented')
  }

  async sendMany (...args: any[]) {
    throw new Error('ScrtRPCAgent#sendMany: not implemented')
  }

  async getLabel (address: string): Promise<string> {
    const { ContractInfo: { label } } = await this.api.query.compute.contractInfo(address)
    return label
  }

  async getCodeId (address: string): Promise<string> {
    const { ContractInfo: { codeId } } = await this.api.query.compute.contractInfo(address)
    return codeId
  }

  async getHash (address: string): Promise<string> {
    return await this.api.query.compute.contractCodeHash(address)
  }

  // @ts-ignore
  async query <Q extends object> (instance: Instance, query: Q) {
    const { address: contractAddress, codeHash } = instance
    const args = { contractAddress, codeHash, query }
    return await this.api.query.compute.queryContract(args)
  }

  async upload (data: Uint8Array): Promise<Template> {
    const sender     = this.address
    const args       = {sender, wasmByteCode: data, source: "", builder: ""}
    const gasLimit   = Number(ScrtGas.defaultFees.upload.amount[0].amount)
    const result     = await this.api.tx.compute.storeCode(args, { gasLimit })
    const findCodeId = (log) => log.type === "message" && log.key === "code_id"
    const codeId     = result.arrayLog?.find(findCodeId)?.value
    const codeHash   = await this.api.query.compute.codeHash(Number(codeId))
    const chainId    = this.chain.id
    return { uploadTx: result.transactionHash, chainId, codeId, codeHash }
  }

  async instantiate (template, label, initMsg, initFunds = []): Promise<Instance> {
    const { chainId, codeId, codeHash } = template
    if (chainId !== this.chain.id) {
      throw new Error(constants.ERR_INIT_CHAIN_ID)
    }
    const sender   = this.address
    const args     = { sender, codeId, codeHash, initMsg, label, initFunds }
    const gasLimit = Number(ScrtGas.defaultFees.init.amount[0].amount)
    const result   = await this.api.tx.compute.instantiateContract(args, { gasLimit })
    if (result.arrayLog) {
      const findAddr = (log) => log.type === "message" && log.key === "contract_address"
      const address  = result.arrayLog.find(findAddr)?.value
      return { chainId, codeId, codeHash, address, label }
    } else {
      throw Object.assign(
        new Error(`SecretRPCAgent#instantiate: ${result.rawLog}`), {
          jsonLog: result.jsonLog
        }
      )
    }
  }

  async execute (instance, msg, opts?): Promise<Tx> {
    const { address, codeHash } = instance
    const { send, memo, fee } = opts
    if (memo) {
      console.warn(constants.WARN_NO_MEMO)
    }
    if (fee) {
      console.warn('Ignoring fee', fee)
    }
    const sender   = this.address
    const args     = { sender, contractAddress: address, codeHash, msg, sentFunds: send }
    const gasLimit = Number(ScrtGas.defaultFees.exec.amount[0].amount)
    return await this.api.tx.compute.executeContract(args, { gasLimit })
  }
}

export class Scrt extends ScrtChain {
  static Agent = ScrtRPCAgent
  // @ts-ignore
  Agent = Scrt.Agent
  // @ts-ignore
  getAgent (options: ScrtRPCAgentOptions): Promise<ScrtRPCAgent> {
    // @ts-ignore
    return super.getAgent(options)
  }

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

export class ScrtRPCBundle extends ScrtBundle {

  agent: ScrtRPCAgent

  async submit (memo = "") {
    this.assertCanSubmit()
    const msgs  = await this.buildForSubmit()
    const limit = Number(ScrtGas.defaultFees.exec.amount[0].amount)
    const gas   = msgs.length * limit
    try {
      const txResult = await this.agent.api.tx.broadcast(msgs, { gasLimit: gas })
      const results  = this.collectSubmitResults(msgs, txResult)
      return results
    } catch (err) {
      await this.handleSubmitError(err)
    }
  }

  /** Format the messages for API v1 like secretjs and encrypt them. */
  protected async buildForSubmit () {
    const encrypted = await Promise.all(this.msgs.map(async ({init, exec})=>{
      if (init) {
        return new MsgInstantiateContract({
          sender:    init.sender,
          codeId:    init.codeId,
          codeHash:  init.codeHash,
          label:     init.label,
          initMsg:   init.msg,
          initFunds: init.funds,
        })
      }
      if (exec) {
        return new MsgExecuteContract({
          sender:          exec.sender,
          contractAddress: exec.contract,
          codeHash:        exec.codeHash,
          msg:             exec.msg,
          sentFunds:       exec.funds,
        })
      }
      throw 'unreachable'
    }))
    return encrypted
  }

  protected collectSubmitResults (msgs, txResult) {
    const results = []
    for (const i in msgs) {
      const msg = msgs[i]
      results[i] = {
        sender:  this.address,
        tx:      txResult.transactionHash,
        chainId: this.chain.id
      }
      if (msg instanceof MsgInstantiateContract) {
        const findAddr = ({msg, type, key}) =>
          msg  ==  i         &&
          type === "message" &&
          key  === "contract_address"
        results[i].type    = 'wasm/MsgInstantiateContract'
        results[i].codeId  = msg.codeId
        results[i].label   = msg.label,
        results[i].address = txResult.arrayLog.find(findAddr)?.value
      }
      if (msgs[i] instanceof MsgExecuteContract) {
        results[i].type    = 'wasm/MsgExecuteContract'
        results[i].address = msg.contractAddress
      }
    }
    return results
  }

  protected async handleSubmitError (err) {
    console.error(err)
    process.exit(124)
  }

  async save (name) {
    throw new Error('ScrtRPCBundle#save: not implemented')
  }

}

export * from '@fadroma/client-scrt'
