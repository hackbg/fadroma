import { Config } from '@hackbg/conf'
import type { ChainId } from '@fadroma/agent'
import {
  assign,
  Connection, Batch,
  Console, Error, bold,
  bip32, bip39, bip39EN, bech32, base64,
  into,
  ContractInstance,
  Token,
} from '@fadroma/agent'
import type { Address, Message, CodeId, CodeHash, UploadedCode, Label } from '@fadroma/agent'
import { CosmWasmClient, SigningCosmWasmClient, serializeSignDoc } from '@hackbg/cosmjs-esm'
import type { logs, OfflineSigner, Block, StdFee } from '@hackbg/cosmjs-esm'
import { ripemd160 } from "@noble/hashes/ripemd160"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"
import { numberToBytesBE } from "@noble/curves/abstract/utils"
import type * as Identity from './cw-identity'

const assertApi =
  ({ api }: { api?: CWConnection["api"] }): NonNullable<CWConnection["api"]> => {
    if (!api) {
      throw new Error('no api')
    }
    return api
  }

/** Generic agent for CosmWasm-enabled chains. */
class CWConnection extends Connection {
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** API connects asynchronously, so API handle is a promise of either variant. */
  declare api: Promise<CosmWasmClient|SigningCosmWasmClient>
  /** A supported method of authentication. */
  declare identity: Identity.CWMnemonicIdentity|Identity.CWSignerIdentity

  constructor (properties: Partial<CWConnection>) {
    super(properties)
    assign(this, properties, [ 'coinType', 'bech32Prefix', 'hdAccountIndex' ])
    this.log.label = `${this.chainId||'no chain id'}(${bold(this.identity?.name??this.address??'no address')})`
    if (this.url) {
      if (this.identity.signer) {
        this.log.debug('Connecting to', bold(this.url), 'as', bold(this.address))
        this.api = SigningCosmWasmClient.connectWithSigner(this.url, this.identity.signer)
      } else {
        this.log.debug('Connecting to', bold(this.url), 'in read-only mode')
        this.api = CosmWasmClient.connect(this.url)
      }
    } else {
      this.log.warn('No connection url.')
    }
  }

  doGetBlockInfo (): Promise<Block> {
    return assertApi(this).then(api=>api.getBlock())
  }

  doGetHeight () {
    return this.doGetBlockInfo().then(
      (info: { header: { height?: number } } = { header: {} })=>Number(info.header.height)
    )
  }

  /** Query native token balance. */
  doGetBalance (
    token:   string = (this.constructor as typeof CWConnection).gasToken.id,
    address: Address|undefined = this.address
  ): Promise<string> {
    if (!address) {
      throw new Error('getBalance: pass (token, address)')
    }
    if (address === this.address) {
      this.log.debug('Querying', bold(token), 'balance')
    } else {
      this.log.debug('Querying', bold(token), 'balance of', bold(address))
    }
    return assertApi(this)
      .then(api=>api.getBalance(address!, token!))
      .then(({amount})=>amount)
  }

  /** Stargate implementation of getting a code id. */
  doGetCodeId (address: Address): Promise<CodeId> {
    if (!address) throw new CWError('chain.getCodeId: no address')
    return assertApi(this)
      .then(api=>api.getContract(address))
      .then(({codeId})=>String(codeId))
  }

  doGetContractsByCodeId (id: CodeId): Promise<Iterable<{address: Address}>> {
    throw new Error('not implemented')
  }

  /** Stargate implementation of getting a code hash. */
  doGetCodeHashOfAddress (address: Address): Promise<CodeHash> {
    return assertApi(this)
      .then(api=>api.getContract(address))
      .then(({codeHash})=>String(codeHash))
  }

  /** Stargate implementation of getting a code hash. */
  doGetCodeHashOfCodeId (codeId: CodeId): Promise<CodeHash> {
    return assertApi(this)
      .then(api=>api.getCodeDetails(Number(codeId)))
      .then(({checksum})=>checksum)
  }

  /** Stargate implementation of getting a contract label. */
  async getLabel (address: Address): Promise<string> {
    if (!address) throw new CWError('chain.getLabel: no address')
    const { label } = await assertApi(this).then(api=>api.getContract(address))
    return label
  }

  /** Stargate implementation of sending native token. */
  async doSend (
    recipient: Address, amounts: Token.ICoin[], options?: Parameters<Connection["doSend"]>[2]
  ) {
    return assertApi(this).then(api=>{
      if (!(api as SigningCosmWasmClient)?.sendTokens) {
        throw new CWError("can't send tokens with an unauthenticated agent")
      } 
      return (api as SigningCosmWasmClient).sendTokens(
        this.address!,
        recipient as string,
        amounts,
        options?.sendFee || 'auto',
        options?.sendMemo
      )
    })
  }

  /** Stargate implementation of batch send. */
  doSendMany (
    outputs: [Address, Token.ICoin[]][],
    options?: Parameters<Connection["doSendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  async doUpload (data: Uint8Array): Promise<Partial<UploadedCode>> {
    if (!this.address) {
      throw new CWError("can't upload contract without sender address")
    }
    return assertApi(this)
      .then(api=>{
        if (!(api as SigningCosmWasmClient)?.upload) {
          throw new CWError("can't upload contract with an unauthenticated agent")
        }
        return (api as SigningCosmWasmClient).upload(
          this.address!, data, this.fees?.upload || 'auto', "Uploaded by Fadroma"
        )
      })
      .then(result=>({
        chainId:   this.chainId,
        codeId:    String(result.codeId),
        codeHash:  result.checksum,
        uploadBy:  this.address,
        uploadTx:  result.transactionHash,
        uploadGas: result.gasUsed
      }))
  }

  /** Instantiate a contract via CosmJS Stargate. */
  async doInstantiate (
    codeId: CodeId, options: Parameters<Connection["doInstantiate"]>[1]
  ): Promise<Partial<ContractInstance>> {
    if (!this.address) {
      throw new CWError("can't instantiate contract without sender address")
    }
    const api = await assertApi(this)
    if (!(api as SigningCosmWasmClient)?.instantiate) {
      throw new CWError("can't instantiate contract without authorizing the agent")
    } 
    const result = await (api as SigningCosmWasmClient).instantiate(
      this.address!,
      Number(codeId),
      options.initMsg,
      options.label!,
      options.initFee as StdFee || 'auto',
      { admin: this.address, funds: options.initSend, memo: options.initMemo }
    )
    return {
      codeId,
      codeHash: options.codeHash,
      label:    options.label,
      initMsg:  options.initMsg,
      chainId:  this.chainId,
      address:  result.contractAddress,
      initTx:   result.transactionHash,
      initGas:  result.gasUsed,
      initBy:   this.address,
      initFee:  options.initFee || 'auto',
      initSend: options.initSend,
      initMemo: options.initMemo
    }
  }

  /** Call a transaction method of a contract. */
  async doExecute (
    contract: { address: Address }, message: Message, options: Parameters<Connection["execute"]>[2] = {}
  ): Promise<unknown> {
    if (!this.address) {
      throw new CWError("can't execute transaction without sender address")
    }
    const api = await assertApi(this)
    if (!(api as SigningCosmWasmClient)?.execute) {
      throw new CWError("can't execute transaction without authorizing the agent")
    } 
    const {
      execSend,
      execMemo,
      execFee = this.fees?.exec || 'auto'
    } = options
    return await (api as SigningCosmWasmClient).execute(
      this.address,
      contract.address,
      message,
      execFee,
      execMemo,
      execSend
    )
  }

  /** Stargate implementation of querying a smart contract. */
  async doQuery <U> (contract: Address|Partial<ContractInstance>, msg: Message): Promise<U> {
    if (typeof contract === 'string') contract = { address: contract }
    if (!contract.address) throw new CWError('no contract address')
    const api = await assertApi(this)
    return await api.queryContractSmart(contract.address, msg) as U
  }

  batch (): CWBatch {
    return new CWBatch(this)
  }
}

/** Transaction batch for CosmWasm-enabled chains. */
class CWBatch extends Batch<CWConnection> {

  upload (
    code:    Parameters<Batch<Connection>["upload"]>[0],
    options: Parameters<Batch<Connection>["upload"]>[1]
  ) {
    return this
  }

  instantiate (
    code:    Parameters<Batch<Connection>["instantiate"]>[0],
    options: Parameters<Batch<Connection>["instantiate"]>[1]
  ) {
    return this
  }

  execute (
    contract: Parameters<Batch<Connection>["execute"]>[0],
    options:  Parameters<Batch<Connection>["execute"]>[1]
  ) {
    return this
  }

  async submit () {}

}

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {}

export {
  CWConfig as Config,
  CWError as Error,
  CWConsole as Console,
  CWConnection as Connection,
  CWBatch as Batch
}
