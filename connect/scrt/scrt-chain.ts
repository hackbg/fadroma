/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { ReadonlySigner, SecretNetworkClient, Wallet } from '@hackbg/secretjs-esm'
import type { CreateClientOptions, EncryptionUtils, TxResponse } from '@hackbg/secretjs-esm'
import { Config, Error, Console } from './scrt-base'
//import * as Mocknet from './scrt-mocknet'
import { ScrtBatchBuilder } from './scrt-batch'
import type {
  Uint128, ContractClient, Message, Name, Address, TxHash, ChainId, CodeId, CodeHash, Label,
} from '@fadroma/agent'
import {
  assign, Agent, into, base64, bip39, bip39EN, bold,
  Token, BatchBuilder,
  UploadedCode, ContractInstance,
} from '@fadroma/agent'

/** Represents a Secret Network API endpoint. */
class ScrtAgent extends Agent {
  /** Smallest unit of native token. */
  static gasToken = 'uscrt'
  /** Connect to the Secret Network Mainnet. */
  static mainnet (options: Partial<ScrtAgent> = {}, config = new Config()): ScrtAgent {
    const { mainnetChainId: chainId, mainnetUrl: chainUrl } = config
    return super.mainnet({ chainId, chainUrl, ...options||{}, }) as ScrtAgent
  }
  /** Connect to the Secret Network Testnet. */
  static testnet (options: Partial<ScrtAgent> = {}, config = new Config()): ScrtAgent {
    const { testnetChainId: chainId, testnetUrl: chainUrl } = config
    return super.testnet({ chainId, chainUrl, ...options||{} }) as ScrtAgent
  }
  /** Connect to Secret Network in testnet mode. */
  static devnet (options: Partial<ScrtAgent> = {}): ScrtAgent {
    throw new Error('Devnet not installed. Import @hackbg/fadroma')
  }
  /** Logger handle. */
  log = new Console('ScrtAgent')
  /** Underlying API client. */
  declare chainApi: SecretNetworkClient
  /** API extra. */
  wallet?: Wallet
  /** API extra. */
  encryptionUtils?: EncryptionUtils
  /** Set permissive fees by default. */
  defaultFees = {
    upload: ScrtAgent.gas(10000000),
    init:   ScrtAgent.gas(10000000),
    exec:   ScrtAgent.gas(1000000),
    send:   ScrtAgent.gas(1000000),
  }

  constructor ({
    mnemonic,
    wallet = mnemonic ? new Wallet(mnemonic) : undefined,
    encryptionUtils,
    ...properties
  }: Partial<ScrtAgent & {
    mnemonic:        string,
    wallet:          Wallet,
    encryptionUtils: EncryptionUtils
  }> = {}) {
    super(properties as Partial<Agent>)
    this.chainApi ??= new SecretNetworkClient({ chainId: this.chainId!, url: this.chainUrl! })
    this.log.label = `${this.address||'ScrtAgent'}`
    if (this.chainId) {
      this.log.label += `@${this.chainId}`
    } else {
      throw new Error("can't authenticate without chainId")
    }
    if (this.chainUrl) {
      this.log.label += `(${this.chainUrl})`
    } else {
      throw new Error("can't connect without chainUrl")
    }
    if (!mnemonic && !wallet) {
      mnemonic = bip39.generateMnemonic(bip39EN)
      wallet = new Wallet(mnemonic)
    }
    let walletAddress = wallet ? wallet.address : properties?.address
    if (walletAddress && properties?.address && (walletAddress !== properties?.address)) {
      throw new Error('computed address did not match passed one')
    }
    this.chainApi = new SecretNetworkClient({
      chainId: this.chainId,
      url: this.chainUrl,
      wallet,
      walletAddress: wallet?.address,
      encryptionUtils
    })
    if (this.address) {
      if (this.chainApi.address !== this.address) {
        throw new Error(`computed address ${this.chainApi.address} but expected ${this.address}`)
      }
    } else {
      this.address = this.chainApi.address
    }
  }

  async getBlockInfo () {
    return await this.chainApi.query.tendermint.getLatestBlock({})
  }

  get height () {
    return this.getBlockInfo().then((block: any)=>Number(block.block?.header?.height))
  }

  get balance ()  {
    if (!this.address) {
      console.trace({agent:this})
      throw new Error("can't get balance of unauthenticated agent")
    }
    return this.getBalance(this.address, ScrtAgent.gasToken).then(x=>String(x))
  }

  async getBalance (address: Address, denom = ScrtAgent.gasToken) {
    const response = await this.chainApi.query.bank.balance({ address, denom })
    return response.balance!.amount!
  }

  async getLabelOfContract (contract_address: Address): Promise<Label> {
    const response = await this.chainApi.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.label!
  }

  async getCodeId (contract_address: Address): Promise<CodeId> {
    const response = await this.chainApi.query.compute.contractInfo({ contract_address })
    return response.ContractInfo!.code_id!
  }

  async getCodeHashOfCodeId (contract_address: Address): Promise<CodeHash> {
    const response = await this.chainApi.query.compute.codeHashByContractAddress({ contract_address })
    return response.code_hash!
  }

  async getCodeHashOfAddress (code_id: CodeId): Promise<CodeHash> {
    const response = await this.chainApi.query.compute.codeHashByCodeId({ code_id })
    return response.code_hash!
  }

  /** Query a contract.
    * @returns the result of the query */
  async doQuery <U> (
    contract: { address: Address, codeHash: CodeHash }, message: Message
  ): Promise<U> {
    const { address: contract_address, codeHash: code_hash } = contract
    const query = message as Record<string, unknown>
    return await this.chainApi.query.compute.queryContract({
      contract_address, code_hash, query
    }) as U
  }

  get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
    return this.chainApi.query.auth.account({ address: this.address })
  }

  protected async doSend (
    recipient: Address,
    amounts:   Token.ICoin[],
    options?:  Parameters<Agent["doSend"]>[2]
  ) {
    return this.chainApi.tx.bank.send(
      { from_address: this.address!, to_address: recipient, amount: amounts },
      { gasLimit: Number(options?.sendFee?.gas) }
    )
  }

  async sendMany (outputs: never, opts?: any) {
    throw new Error('ScrtAgent#sendMany: not implemented')
  }

  /** Upload a WASM binary. */
  protected async doUpload (data: Uint8Array): Promise<Partial<UploadedCode>> {
    const request  = {
      sender: this.address!, wasm_byte_code: data, source: "", builder: ""
    }
    const gasLimit = Number(this.defaultFees.upload?.amount[0].amount)
      || undefined
    const result = await this.chainApi!.tx.compute.storeCode(request, { gasLimit })
      .catch((error:any)=>error)
    const {
      code, message, details = [], rawLog 
    } = result
    if (code !== 0) {
      this.log.error(`Upload failed with code ${bold(code)}:`, bold(message ?? rawLog ?? ''), ...details)
      if (message === `account ${this.address} not found`) {
        this.log.info(`If this is a new account, send it some ${ScrtAgent.gasToken} first.`)
        if (this.isMainnet) {
          this.log.info(`Mainnet fee grant faucet:`, bold(`https://faucet.secretsaturn.net/`))
        }
        if (this.isTestnet) {
          this.log.info(`Testnet faucet:`, bold(`https://faucet.pulsar.scrttestnet.com/`))
        }
      }
      this.log.error(`Upload failed`, { result })
      throw new Error('upload failed')
    }
    type Log = { type: string, key: string }
    const codeId = result.arrayLog
      ?.find((log: Log) => log.type === "message" && log.key === "code_id")
      ?.value
    if (!codeId) {
      this.log.error(`Code ID not found in result`, { result })
      throw new Error('upload failed')
    }
    return {
      chainId:  this.chainId,
      codeId,
      codeHash: await this.getCodeHashOfCodeId(codeId),
      uploadBy: this.address,
      uploadTx: result.transactionHash,
      uploadGas: result.gasUsed
    }
  }

  protected async doInstantiate (
    codeId: CodeId,
    options: Parameters<Agent["doInstantiate"]>[1]
  ): Promise<Partial<ContractInstance>> {
    if (!this.address) throw new Error("agent has no address")
    const parameters = {
      sender:     this.address,
      code_id:    Number(codeId),
      code_hash:  options.codeHash,
      label:      options.label!,
      init_msg:   options.initMsg,
      init_funds: options.initSend,
      memo:       options.initMemo
    }
    const instantiateOptions = {
      gasLimit: Number(this.defaultFees.init?.amount[0].amount) || undefined
    }
    const result = await this.chainApi.tx.compute.instantiateContract(parameters, instantiateOptions)
    if (result.code !== 0) {
      this.log.error('Init failed:', { parameters, instantiateOptions, result })
      throw new Error(`init of code id ${codeId} failed`)
    }

    type Log = { type: string, key: string }
    const address = result.arrayLog!
      .find((log: Log) => log.type === "message" && log.key === "contract_address")
      ?.value!

    return {
      chainId:  this.chainId,
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
    options?: Parameters<Agent["doExecute"]>[2] & {
      preSimulate?: boolean
    }
  ): Promise<TxResponse> {
    const tx = {
      sender:           this.address!,
      contract_address: contract.address,
      code_hash:        contract.codeHash,
      msg:              message as Record<string, unknown>,
      sentFunds:        options?.execSend
    }
    const txOpts = {
      gasLimit: Number(options?.execFee?.gas) || undefined
    }
    if (options?.preSimulate) {
      this.log.info('Simulating transaction...')
      let simResult
      try {
        simResult = await this.chainApi.tx.compute.executeContract.simulate(tx, txOpts)
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
    const result = await this.chainApi.tx.compute.executeContract(tx, txOpts)
    // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
    if (result.code !== 0) throw this.decryptError(result)
    return result as TxResponse
  }

  async setMaxGas (): Promise<this> {
    const max = ScrtAgent.gas((await this.fetchLimits()).gas)
    this.defaultFees = { upload: max, init: max, exec: max, send: max }
    return this
  }

  async fetchLimits (): Promise<{ gas: number }> {
    const params = { subspace: "baseapp", key: "BlockParams" }
    const { param } = await this.chainApi.query.params.params(params)
    let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
    this.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
    if (max_gas < 0) {
      max_gas = 10000000
      this.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
    }
    return { gas: max_gas }
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const result = await this.chainApi.query.auth.account({ address: this.address }) ?? (() => {
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    })
    const { account_number, sequence } = result.account as any
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) {
      throw new Error("can't encrypt message without code hash")
    }
    const { encryptionUtils } = this.chainApi as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
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

  batch (): ScrtBatchBuilder {
    return new ScrtBatchBuilder(this)
  }

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

export {
  ScrtAgent as Agent
}

export type {
  TxResponse
}
