import { SecretNetworkClient, Wallet } from 'secretjs'
import { Chain, Agent, AgentOptions, Gas, Fees } from '@fadroma/client'
import * as constants from './constants'

export interface ScrtRPCAgentOptions extends AgentOptions {
  wallet?:  Wallet
  api?:     SecretNetworkClient
  keyPair?: unknown
}

export class ScrtRPCAgent extends Agent {

  Bundle = null

  static async create (chain: Scrt, options: ScrtRPCAgentOptions) {
    const {
      mnemonic,
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
    const wallet = new Wallet(mnemonic)
    if (address && address !== wallet.address) {
      throw new Error(constants.ERR_EXPECTED_WRONG_ADDRESS)
    }
    const api = await SecretNetworkClient.create({
      chainId:       chain.id,
      grpcWebUrl:    "https://grpc-web.azure-api.net",
      wallet:        wallet,
      walletAddress: wallet.address,
    })
    return new ScrtRPCAgent(chain, { ...options, wallet, api })
  }

  constructor (chain: Scrt, options: ScrtRPCAgentOptions) {
    super(chain, options)

    this.wallet = options.wallet
    this.api    = options.api

    this.address = this.wallet.address
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

  async getCodeId (address: string): Promise<number> {
    const { ContractInfo: { codeId } } = await this.api.query.compute.contractInfo(address)
    return Number(codeId)
  }

  async doQuery ({ address, codeHash }, query) {
    const contractAddress = address
    return await this.api.query.compute.queryContract({ contractAddress, codeHash, query })
  }

  async doInstantiate (template, label, initMsg, initFunds = []) {
    const { codeId, codeHash } = template
    return await this.api.tx.compute.instantiateContract({
      sender: this.address,
      codeId,
      codeHash,
      initMsg,
      label,
      initFunds
    })
  }

  async doExecute (instance, msg, sentFunds, memo, fee) {
    const { address, codeHash } = instance
    if (memo) {
      console.warn(constants.WARN_NO_MEMO)
    }
    return await this.api.tx.compute.executeContract({
      sender: this.address,
      contractAddress: address,
      codeHash,
      msg,
      sentFunds
    })
  }

}

export class Scrt extends Chain {
  static Agent = ScrtRPCAgent
  Agent = Scrt.Agent

  static Mainnet = class ScrtMainnet extends Scrt {
    mode = Chain.Mode.Mainnet
  }
  static Testnet = class ScrtTestnet extends Scrt {
    mode = Chain.Mode.Testnet
  }
  static Devnet  = class ScrtTestnet extends Scrt {
    mode = Chain.Mode.Devnet
  }
  static Mocknet = class ScrtTestnet extends Scrt {
    mode = Chain.Mode.Mocknet
  }
}

export class ScrtGas extends Gas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}
