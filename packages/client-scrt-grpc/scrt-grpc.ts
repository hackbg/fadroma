import {
  Address,
  AgentOpts,
  ChainId,
  ChainOpts,
  Template,
  Instance,
  ScrtChain,
  ScrtAgent,
  ScrtGas,
  ScrtBundle,
  Message,
  ExecOpts
} from '@fadroma/client-scrt'
import type { Tx } from 'secretjs'
import {
  SecretNetworkClient,
  Wallet,
  MsgInstantiateContract,
  MsgExecuteContract,
} from 'secretjs'

export interface ScrtRPCAgentOpts extends AgentOpts {
  wallet?:  Wallet
  url?:     string
  api?:     SecretNetworkClient
  keyPair?: unknown
}

export const constants = {
  DEFAULT_CHAIN_ID:
    'secret-4',
  ERR_ONLY_FROM_MNEMONIC_OR_WALLET_ADDRESS:
    'ScrtRPCAgent: Can only be created from mnemonic or wallet+address',
  WARN_IGNORING_KEY_PAIR:
    'ScrtRPCAgent: Created from mnemonic, ignoring keyPair',
  ERR_EXPECTED_WRONG_ADDRESS:
    'ScrtRPCAgent: Passed an address that does not correspond to the mnemonic',
  WARN_NO_MEMO:
    "ScrtRPCAgent: Transaction memos are not supported in SecretJS RPC API",
  ERR_INIT_CHAIN_ID:
    'ScrtRPCAgent: Tried to instantiate a contract that is uploaded to another chain',
  COULD_NOT_DECODE:
    '<binary data, see result.original for the raw Uint8Array>'
}

const decoder = new TextDecoder('utf-8', { fatal: true })

const tryDecode = (data: Uint8Array): string => {
  try {
    return decoder.decode(data)
  } catch (e) {
    return constants.COULD_NOT_DECODE
  }
}

export class ScrtRPCAgent extends ScrtAgent {

  // @ts-ignore
  Bundle = ScrtRPCBundle

  static async create (
    chain:   Scrt,
    options: ScrtRPCAgentOpts
  ): Promise<ScrtRPCAgent> {
    const { mnemonic, keyPair, address } = options
    let { wallet } = options
    if (!wallet) {
      if (mnemonic) {
        wallet = new Wallet(mnemonic)
      } else {
        throw new Error(constants.ERR_ONLY_FROM_MNEMONIC_OR_WALLET_ADDRESS)
      }
    }
    if (keyPair) {
      console.warn(constants.WARN_IGNORING_KEY_PAIR)
      delete options.keyPair
    }
    const api = await SecretNetworkClient.create({
      chainId:    chain.id,
      grpcWebUrl: chain.url || "http://rpc.pulsar.griptapejs.com:9091",
      wallet,
      walletAddress: wallet.address || address
    })
    return new ScrtRPCAgent(chain, { ...options, wallet, api })
  }

  constructor (chain: Scrt, options: ScrtRPCAgentOpts) {
    // @ts-ignore
    super(chain, options)
    this.wallet  = options.wallet
    this.api     = options.api
    this.address = this.wallet?.address
  }

  wallet: Wallet

  api:    SecretNetworkClient

  address: string

  get account () {
    return this.api.query.auth.account({ address: this.address })
  }
  get balance () {
    return this.getBalance(this.defaultDenom, this.address)
  }
  async getBalance (denom = this.defaultDenom, address: Address) {
    const response = await this.api.query.bank.balance({ address, denom })
    return response.balance.amount
  }
  async send (to, amounts, opts?) {
    return this.api.tx.bank.send({
      fromAddress: this.address,
      toAddress:   to,
      amount:      amounts
    }, {
      gasLimit: opts?.gas?.gas
    })
  }
  async sendMany (outputs, opts) {
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
  async query <U> (instance: Instance, query: Message): Promise<U> {
    const { address: contractAddress, codeHash } = instance
    const args = { contractAddress, codeHash, query: query as Record<string, unknown> }
    // @ts-ignore
    return await this.api.query.compute.queryContract(args) as U
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
  async execute (instance: Instance, msg: Message, opts: ExecOpts = {}): Promise<Tx> {
    const { address, codeHash } = instance
    const { send, memo, fee = this.fees.exec } = opts
    if (memo) {
      console.warn(constants.WARN_NO_MEMO)
    }
    const result = await this.api.tx.compute.executeContract({
      sender:          this.address,
      contractAddress: address,
      codeHash,
      msg:             msg as Record<string, unknown>,
      sentFunds:       send
    }, {
      gasLimit: Number(fee.amount[0].amount)
    })
    // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
    if (result.code !== 0) {
      const error = `ScrtRPCAgent#execute: gRPC error ${result.code}: ${result.rawLog}`
      // make the original result available on request
      const original = structuredClone(result)
      Object.defineProperty(result, "original", {
        enumerable: false,
        get () { return original }
      })
      // decode the values in the result
      //@ts-ignore
      result.txBytes = tryDecode(result.txBytes)
      for (const i in result.tx.signatures) {
        //@ts-ignore
        result.tx.signatures[i] = tryDecode(result.tx.signatures[i])
      }
      for (const event of result.events) {
        for (const attr of event.attributes) {
          try {
            //@ts-ignore
            attr.key   = tryDecode(attr.key)
          } catch (e) {}
          try {
            //@ts-ignore
            attr.value = tryDecode(attr.value)
          } catch (e) {}
        }
      }
      throw Object.assign(new Error(error), result)
    }
    return result as Tx
  }
}

export class Scrt extends ScrtChain {

  api = SecretNetworkClient.create({ chainId: this.id, grpcWebUrl: this.url })

  static Agent = ScrtRPCAgent

  // @ts-ignore
  Agent = Scrt.Agent

  // @ts-ignore
  getAgent (options: ScrtRPCAgentOpts): Promise<ScrtRPCAgent> {
    // @ts-ignore
    return super.getAgent(options)
  }

  async getBalance (denom = this.defaultDenom, address: Address) {
    const response = await (await this.api).query.bank.balance({ address, denom })
    return response.balance.amount
  }
  async getLabel (address: string): Promise<string> {
    const { ContractInfo: { label } } = await (await this.api).query.compute.contractInfo(address)
    return label
  }
  async getCodeId (address: string): Promise<string> {
    const { ContractInfo: { codeId } } = await (await this.api).query.compute.contractInfo(address)
    return codeId
  }
  async getHash (address: string): Promise<string> {
    return await (await this.api).query.compute.contractCodeHash(address)
  }

  // @ts-ignore
  async query <U> (instance: Instance, query: Message): Promise<U> {
    throw new Error('TODO: Scrt#query: use same method on agent')
  }

  get block () {
    return this.api.then(api=>api.query.tendermint.getLatestBlock({}))
  }

  get height () {
    return this.block.then(block=>Number(block.block.header.height))
  }
}

export class ScrtRPCBundle extends ScrtBundle {

  // @ts-ignore
  agent: ScrtRPCAgent

  async submit (memo = "") {
    this.assertCanSubmit()
    const msgs  = await this.buildForSubmit()
    const limit = Number(ScrtGas.defaultFees.exec.amount[0].amount)
    const gas   = msgs.length * limit
    try {
      const txResult = await this.agent.api.tx.broadcast(msgs, { gasLimit: gas })
      if (txResult.code !== 0) {
        const error = `ScrtRPCBundle#execute: gRPC error ${txResult.code}: ${txResult.rawLog}`
        throw Object.assign(new Error(error), txResult)
      }
      const results = this.collectSubmitResults(msgs, txResult)
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
    console.error('Submitting bundle failed:', err.message)
    console.error('Decrypting gRPC bundle errors is not implemented.')
    process.exit(124)
  }

  async save (name) {
    throw new Error('ScrtRPCBundle#save: not implemented')
  }

}

export * from '@fadroma/client-scrt'
export type { Tx }
