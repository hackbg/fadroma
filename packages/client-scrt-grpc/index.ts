import { Agent, AgentOptions, ScrtChain, ScrtGas, Template } from '@fadroma/client-scrt'
import { SecretNetworkClient, Wallet } from 'secretjs'
import * as constants from './constants'

export interface ScrtRPCAgentOptions extends AgentOptions {
  wallet?:  Wallet
  url?:     string
  api?:     SecretNetworkClient
  keyPair?: unknown
}

export class ScrtRPCAgent extends Agent {

  Bundle = null

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

  async query ({ address, codeHash }, query) {
    const contractAddress = address
    const args = { contractAddress, codeHash, query }
    return await this.api.query.compute.queryContract(args)
  }

  async instantiate (template, label, initMsg, initFunds = []) {
    const { codeId, codeHash } = template
    const sender   = this.address
    const args     = { sender, codeId, codeHash, initMsg, label, initFunds }
    const gasLimit = Number(ScrtGas.defaultFees.init.amount[0].amount)
    return await this.api.tx.compute.instantiateContract(args, { gasLimit })
  }

  async execute (instance, msg, sentFunds, memo, fee) {
    const { address, codeHash } = instance
    if (memo) {
      console.warn(constants.WARN_NO_MEMO)
    }
    const sender   = this.address
    const args     = { sender, contractAddress: address, codeHash, msg, sentFunds }
    const gasLimit = Number(ScrtGas.defaultFees.exec.amount[0].amount)
    return await this.api.tx.compute.executeContract(args, { gasLimit })
  }

  async upload (data: Uint8Array): Promise<Template> {
    const sender     = this.address
    const args       = {sender, wasmByteCode: data, source: "", builder: ""}
    const gasLimit   = Number(ScrtGas.defaultFees.upload.amount[0].amount)
    const result     = await this.api.tx.compute.storeCode(args, { gasLimit })
    const findCodeId = (log) => log.type === "message" && log.key === "code_id"
    const codeId     = result.arrayLog?.find(findCodeId)?.value
    const codeHash   = await this.api.query.compute.codeHash(Number(codeId))
    return {
      chainId: this.chain.id,
      codeId,
      codeHash,
    }
  }
}

export class Scrt extends ScrtChain {
  static Agent = ScrtRPCAgent
  Agent = Scrt.Agent
}

export * from '@fadroma/client-scrt'
