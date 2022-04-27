import { Agent, Identity, Artifact, Template, Instance, Message, readFile } from '@fadroma/ops'
import { SecretNetworkClient, Wallet } from 'secretjs'

export interface ScrtRPCAgentOptions extends Identity {
  wallet?: Wallet
  api?:    SecretNetworkClient
}

export class ScrtRPCAgent extends Agent {

  Bundle = null

  static async create (identity: Identity) {
    const {
      chainId = SCRT_RPC_DEFAULT_CHAIN_ID,
      mnemonic,
      keyPair,
      address
    } = identity
    if (!mnemonic) {
      throw new Error(ERR_SCRT_RPC_ONLY_FROM_MNEMONIC)
    }
    if (keyPair) {
      console.warn(WARN_SCRT_RPC_IGNORING_KEY_PAIR)
      delete identity.keyPair
    }
    const wallet = new Wallet(mnemonic)
    if (address && address !== wallet.address) {
      throw new Error(ERR_SCRT_RPC_EXPECTED_WRONG_ADDRESS)
    }
    const api = await SecretNetworkClient.create({
      chainId,
      grpcWebUrl:    "https://grpc-web.azure-api.net",
      wallet:        wallet,
      walletAddress: wallet.address,
    })
    return new ScrtRPCAgent({ ...identity, wallet, api })
  }

  constructor (options: ScrtRPCAgentOptions) {
    super(options)
    this.wallet = options.wallet
    this.api    = options.api
  }

  wallet: Wallet

  api:    SecretNetworkClient

  defaultDenomination = 'uscrt'

  get address () {
    return this.wallet.address
  }

  async upload (artifact: Artifact): Promise<Template> {

    const data = await readFile(artifact.location)

    const tx = await this.api.tx.compute.storeCode({
      sender:       this.address,
      wasmByteCode: data,
      source:       "",
      builder:      ""
    }, {
      gasLimit: 1_000_000
    })

    const codeId = tx.arrayLog
      .find((log) => log.type === "message" && log.key === "code_id")
      .value

    const codeHash = tx.arrayLog
      .find((log) => log.type === "message" && log.key === "code_hash")
      .value

    return {
      chainId: this.chainId,
      codeId,
      codeHash
    }

  }

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
      console.warn(WARN_SCRT_RPC_NO_MEMO)
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

export const SCRT_RPC_DEFAULT_CHAIN_ID =
  'secret-4'

export const ERR_SCRT_RPC_ONLY_FROM_MNEMONIC =
  'ScrtRPCAgent: Can only be created from mnemonic' 

export const WARN_SCRT_RPC_IGNORING_KEY_PAIR =
  'ScrtRPCAgent: Created from mnemonic, ignoring keyPair'

export const ERR_SCRT_RPC_EXPECTED_WRONG_ADDRESS =
  'ScrtRPCAgent: Passed an address that does not correspond to the mnemonic'

export const WARN_SCRT_RPC_NO_MEMO =
  "ScrtRPCAgent: Transaction memos are not supported in SecretJS RPC API"
