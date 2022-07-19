import {
  Address,
  Agent,
  AgentOpts,
  Bundle,
  Chain,
  ChainId,
  ChainOpts,
  Client,
  ExecOpts,
  Fee,
  IFee,
  Instance,
  Message,
  Template,
  Uint128,
} from '@fadroma/client'

import {
  SecretNetworkClient,
  Wallet,
  MsgInstantiateContract,
  MsgExecuteContract,
} from 'secretjs'

import type { Tx } from 'secretjs'
export type { Tx }

import { randomBytes } from '@hackbg/formati'
import { Environment } from '@hackbg/komandi'

export interface SecretNetworkAgentOpts extends AgentOpts {
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

export class SecretNetwork extends Chain {

  defaultDenom    = SecretNetwork.defaultDenom

  isSecretNetwork = true

  api             = SecretNetworkClient.create({ chainId: this.id, grpcWebUrl: this.url })

  // @ts-ignore
  Agent = Scrt.Agent

  // @ts-ignore
  getAgent (options: SecretNetworkAgentOpts): Promise<SecretNetworkAgent> {
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

  static Agent = class SecretNetworkAgent extends Agent {

    fees = SecretNetwork.defaultFees

    async instantiateMany (configs: [Template, string, Message][] = []) {
      // instantiate multiple contracts in a bundle:
      const instances = await this.bundle().wrap(async bundle=>{
        await bundle.instantiateMany(configs)
      })
      // add code hashes to them:
      for (const i in configs) {
        const [{ codeId, codeHash }, label] = configs[i]
        const instance = instances[i]
        if (instance) {
          instance.codeId   = codeId
          instance.codeHash = codeHash
          instance.label    = label
        }
      }
      return instances
    }

    // @ts-ignore
    Bundle = SecretNetworkBundle

    static async create (
      chain:   Chain,
      options: SecretNetworkAgentOpts
    ): Promise<SecretNetworkAgent> {
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
      return new SecretNetworkAgent(chain, { ...options, wallet, api })
    }

    constructor (chain: Chain, options: SecretNetworkAgentOpts) {
      // @ts-ignore
      super(chain, options)
      this.wallet  = options.wallet
      this.api     = options.api
      this.address = this.wallet?.address
    }

    wallet:  Wallet

    api:     SecretNetworkClient

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
      throw new Error('SecretNetworkAgent#sendMany: not implemented')
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
      const gasLimit   = Number(SecretNetwork.defaultFees.upload.amount[0].amount)
      const result     = await this.api.tx.compute.storeCode(args, { gasLimit })
      const findCodeId = (log) => log.type === "message" && log.key === "code_id"
      const codeId     = result.arrayLog?.find(findCodeId)?.value
      const codeHash   = await this.api.query.compute.codeHash(Number(codeId))
      const chainId    = this.chain.id
      return new Template(
        chainId,
        codeId,
        codeHash,
        result.transactionHash
      )
    }

    async instantiate (template, label, initMsg, initFunds = []): Promise<Instance> {
      const { chainId, codeId, codeHash } = template
      if (chainId !== this.chain.id) {
        throw new Error(constants.ERR_INIT_CHAIN_ID)
      }
      const sender   = this.address
      const args     = { sender, codeId, codeHash, initMsg, label, initFunds }
      const gasLimit = Number(SecretNetwork.defaultFees.init.amount[0].amount)
      const result   = await this.api.tx.compute.instantiateContract(args, { gasLimit })
      if (result.arrayLog) {
        const findAddr = (log) => log.type === "message" && log.key === "contract_address"
        const address  = result.arrayLog.find(findAddr)?.value
        return { initTx: result.transactionHash, chainId, codeId, codeHash, address, label, template }
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
        const error = `SecretNetworkAgent#execute: gRPC error ${result.code}: ${result.rawLog}`
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
            //@ts-ignore
            try { attr.key   = tryDecode(attr.key)   } catch (e) {}
            //@ts-ignore
            try { attr.value = tryDecode(attr.value) } catch (e) {}
          }
        }
        throw Object.assign(new Error(error), result)
      }
      return result as Tx
    }

    static Bundle = class SecretNetworkBundle extends Bundle {

      // @ts-ignore
      agent: SecretNetworkAgent

      async submit (memo = "") {
        this.assertCanSubmit()
        const msgs  = await this.buildForSubmit()
        const limit = Number(SecretNetwork.defaultFees.exec.amount[0].amount)
        const gas   = msgs.length * limit
        try {
          const txResult = await this.agent.api.tx.broadcast(msgs, { gasLimit: gas })
          if (txResult.code !== 0) {
            const error = `SecretNetworkBundle#execute: gRPC error ${txResult.code}: ${txResult.rawLog}`
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
        throw new Error('SecretNetworkBundle#save: not implemented')
      }

    }

  }

  static defaultDenom = 'uscrt'

  static gas = (amount: Uint128|number) => new Fee(amount, this.defaultDenom)

  static defaultFees = {
    upload: this.gas(4000000),
    init:   this.gas(1000000),
    exec:   this.gas(1000000),
    send:   this.gas( 500000),
  }

}

export interface ScrtBundleCtor <B extends SecretNetwork['Agent']['Bundle']> {
  new (agent: SecretNetwork['Agent']): B
}

export interface ScrtBundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

/** Data used for creating a signature as per the SNIP-24 spec:
  * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
  * This type is case sensitive! */
export interface SignDoc {
  readonly chain_id:       string;
  /** Always 0. */
  readonly account_number: string;
  /** Always 0. */
  readonly sequence:       string;
  /** Always 0 uscrt + 1 gas */
  readonly fee:            IFee;
  /** Always 1 message of type query_permit */
  readonly msgs:           readonly AminoMsg[];
  /** Always empty. */
  readonly memo:           string;
}

export function createSignDoc <T> (
  chain_id:   ChainId,
  permit_msg: T
) {
  return {
    chain_id,
    account_number: "0", // Must be 0
    sequence: "0", // Must be 0
    fee: {
      amount: [{ denom: "uscrt", amount: "0" }], // Must be 0 uscrt
      gas: "1", // Must be 1
    },
    msgs: [
      {
        type: "query_permit", // Must be "query_permit"
        value: permit_msg,
      },
    ],
    memo: "", // Must be empty
  }
}

export interface Signer {
  chain_id: ChainId
  address:  Address
  sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
}

export class KeplrSigner implements Signer {

  constructor (
    /** The id of the chain which permits will be signed for. */
    readonly chain_id: ChainId,
    /** The address which will do the signing and
      * which will be the address used by the contracts. */
    readonly address:  Address,
    /** Must be a pre-configured instance. */
    readonly keplr:    KeplrSigningHandle<any>
  ) {}

  async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {

    const { signature } = await this.keplr.signAmino(
      this.chain_id,
      this.address,
      createSignDoc(this.chain_id, permit_msg),
      {
        preferNoSetFee: true,  // Fee must be 0, so hide it from the user
        preferNoSetMemo: true, // Memo must be empty, so hide it from the user
      }
    )

    return {
      params: {
        chain_id:       this.chain_id,
        allowed_tokens: permit_msg.allowed_tokens,
        permit_name:    permit_msg.permit_name,
        permissions:    permit_msg.permissions
      },
      signature
    }

  }

}

export interface KeplrSigningHandle <T> {
  signAmino (
    chain_id: ChainId,
    address:  Address,
    signDoc:  SignDoc,
    options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
  ): Promise<Permit<T>>
}

export interface Permit<T> {
  params: {
    permit_name:    string,
    allowed_tokens: Address[]
    chain_id:       string,
    permissions:    T[]
  },
  signature: Signature
}

// This type is case sensitive!
export interface Signature {
  readonly pub_key: Pubkey
  readonly signature: string
}

export interface Pubkey {
  /** Must be: `tendermint/PubKeySecp256k1` */
  readonly type: string
  readonly value: any
}

export interface AminoMsg {
  readonly type: string;
  readonly value: any;
}

/** Used as the `value` field of the {@link AminoMsg} type. */
export interface PermitAminoMsg<T> {
  permit_name:    string,
  allowed_tokens: Address[],
  permissions:    T[],
}

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  async create (entropy = randomBytes(32).toString("hex")) {
    const msg    = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) data = [data]
    return data[0]
  }

  async set (key: unknown) {
    return this.execute({ set_viewing_key: { key } })
  }

}

export * from '@fadroma/client'

export class SecretNetworkConfig extends Environment {
  agent = {
    name:     this.getStr( 'SCRT_AGENT_NAME',       ()=>null),
    address:  this.getStr( 'SCRT_AGENT_ADDRESS',    ()=>null),
    mnemonic: this.getStr( 'SCRT_AGENT_MNEMONIC',   ()=>null),
  }
  mainnet = {
    chainId:  this.getStr( 'SCRT_MAINNET_CHAIN_ID', ()=>'secret-4'),
    apiUrl:   this.getStr( 'SCRT_MAINNET_API_URL',  ()=>null),
  }
  testnet = {
    chainId:  this.getStr( 'SCRT_TESTNET_CHAIN_ID', ()=>'pulsar-2'),
    apiUrl:   this.getStr( 'SCRT_TESTNET_API_URL',  ()=>null),
  }
}
