import { Agent, Identity, Artifact, Template, readFile } from '@fadroma/ops'
import { SecretNetworkClient, Wallet } from 'secretjs'

export interface ScrtRPCAgentOptions extends Identity {
  wallet?: Wallet
  api?:    SecretNetworkClient
}

export class ScrtRPCAgent extends Agent {
  static async create (identity: Identity) {
    if (!identity.mnemonic) {
      throw new Error('ScrtRPCAgent: Can only be created from mnemonic')
    }
    if (identity.keyPair) {
      console.warn('ScrtRPCAgent: Created from mnemonic, ignoring keyPair')
    }
    const wallet = new Wallet(identity.mnemonic)
    if (identity.address && identity.address !== wallet.address) {
      throw new Error('ScrtRPCAgent: Passed an address that does not correspond to the mnemonic')
    }
    const api = await SecretNetworkClient.create({
      grpcWebUrl:    "https://grpc-web.azure-api.net",
      chainId:       "secret-4",
      wallet:        wallet,
      walletAddress: wallet.address,
    })
  }
  constructor (options: ScrtRPCAgentOptions) {
    super(options)
    this.api    = options.api
    this.wallet = options.wallet
  }
  api:    SecretNetworkClient
  wallet: Wallet

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

    const codeId = Number(
      tx.arrayLog
        .find((log) => log.type === "message" && log.key === "code_id")
        .value)

    return { chainId: this.chainId, codeId, codeHash }

  }

  async sendMany (...args: any[]) {
    throw new Error('ScrtRPCAgent#sendMany: not implemented')
  }
}
