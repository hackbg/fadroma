import { Core, Chain, Deploy } from '@fadroma/agent'
import type { Address, Message, CodeId, CodeHash, Token } from '@fadroma/agent'
import type { CWMnemonicIdentity, CWSignerIdentity } from './cw-identity'
import { CWConsole as Console, CWError as Error } from './cw-base'
import { CWBatch } from './cw-batch'

import { Amino, Proto, CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { Block } from '@hackbg/cosmjs-esm'

import {
  getBalance,
  send,
} from './cw-bank'

import {
  getCodes,
  getCodeId,
  getContractsByCodeId,
  getCodeHashOfAddress,
  getCodeHashOfCodeId,
  getLabel,
  upload,
  instantiate,
  execute,
  query
} from './cw-compute'

import type {
  SigningConnection
} from './cw-compute'

import {
  Validator,
  getValidators,
} from './cw-staking'

/** Generic agent for CosmWasm-enabled chains. */
export class CWConnection extends Chain.Connection {
  /** The bech32 prefix for the account's address  */
  bech32Prefix?:    string
  /** The coin type in the HD derivation path */
  coinType?:        number
  /** The account index in the HD derivation path */
  hdAccountIndex?:  number
  /** API connects asynchronously, so API handle is a promise of either variant. */
  declare api:      Promise<CosmWasmClient|SigningCosmWasmClient>
  /** A supported method of authentication. */
  declare identity: CWMnemonicIdentity|CWSignerIdentity

  constructor (properties: Partial<CWConnection>) {
    super(properties)
    Core.assign(this, properties, [
      'coinType',
      'bech32Prefix',
      'hdAccountIndex'
    ])
    if (!this.url) {
      throw new Error('No connection URL.')
    }
    if (this.identity?.signer) {
      this.log.debug('Connecting and authenticating via', Core.bold(this.url))
      this.api = SigningCosmWasmClient.connectWithSigner(this.url, this.identity.signer)
    } else {
      this.log.debug('Connecting anonymously via', Core.bold(this.url))
      this.api = CosmWasmClient.connect(this.url)
    }
  }

  /** Handle to the API's internal query client. */
  get queryClient (): Promise<ReturnType<CosmWasmClient["getQueryClient"]>> {
    return Promise.resolve(this.api).then(api=>(api as any)?.queryClient)
  }

  /** Handle to the API's internal Tendermint transaction client. */
  get tendermintClient (): Promise<ReturnType<CosmWasmClient["getTmClient"]>> {
    return Promise.resolve(this.api).then(api=>(api as any)?.tmClient)
  }

  abciQuery (path, params = new Uint8Array()) {
    return this.queryClient.then(async client=>{
      this.log.debug('ABCI query:', path)
      const { value } = await client.queryAbci(path, params)
      return value
    })
  }

  doGetBlockInfo (): Promise<Block> {
    return Promise.resolve(this.api)
      .then(api=>api.getBlock())
  }

  doGetHeight () {
    return this.doGetBlockInfo().
      then((info: { header: { height?: number } } = { header: {} }) => Number(info.header.height))
  }

  /** Query native token balance. */
  doGetBalance (
    token:   string = this.defaultDenom,
    address: Address|undefined = this.address
  ): Promise<string> {
    return getBalance(this, token, address)
  }

  doGetCodes () {
    return getCodes(this)
  }

  doGetCodeId (address: Address): Promise<CodeId> {
    return getCodeId(this, address)
  }

  doGetContractsByCodeId (id: CodeId): Promise<Iterable<{address: Address}>> {
    return getContractsByCodeId(this, id)
  }

  doGetCodeHashOfAddress (address: Address): Promise<CodeHash> {
    return getCodeHashOfAddress(this, address)
  }

  doGetCodeHashOfCodeId (codeId: CodeId): Promise<CodeHash> {
    return getCodeHashOfCodeId(this, codeId)
  }

  async getLabel (address: Address): Promise<string> {
    return getLabel(this, address)
  }

  async doSend (
    recipient: Address,
    amounts:   Token.ICoin[],
    options?:  Parameters<Chain.Connection["doSend"]>[2]
  ) {
    return send(this as SigningConnection, recipient, amounts, options)
  }

  doSendMany (
    outputs: [Address, Token.ICoin[]][],
    options?: Parameters<Chain.Connection["doSendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error('doSendMany: not implemented')
  }

  async doUpload (data: Uint8Array): Promise<Partial<Deploy.UploadedCode>> {
    if (!this.address) {
      throw new Error("can't upload contract without sender address")
    }
    return upload(this as SigningConnection, data)
  }

  async doInstantiate (
    codeId: CodeId, options: Parameters<Chain.Connection["doInstantiate"]>[1]
  ): Promise<Partial<Deploy.ContractInstance>> {
    if (!this.address) {
      throw new Error("can't instantiate contract without sender address")
    }
    return instantiate(this as SigningConnection, codeId, options)
  }

  async doExecute (
    contract: { address: Address }, 
    message: Message,
    options: Omit<NonNullable<Parameters<Chain.Connection["execute"]>[2]>, 'execFee'> & {
      execFee?: Token.IFee | number | 'auto'
    } = {}
  ): Promise<unknown> {
    if (!this.address) {
      throw new Error("can't execute transaction without sender address")
    }
    options.execFee ??= 'auto'
    return execute(this as SigningConnection, contract, message, options)
  }

  async doQuery <U> (
    contract: Address|{ address: Address }, message: Message
  ): Promise<U> {
    return query(this, contract, message)
  }

  batch (): Chain.Batch<this> {
    return new CWBatch({ connection: this }) as unknown as Chain.Batch<this>
  }

  getValidators ({ details = false }: {
    details?: boolean
  } = {}) {
    return this.tendermintClient.then(()=>getValidators(this, { details }))
  }

  getValidator (address: Address): Promise<unknown> {
    return Promise.all([
      this.queryClient,
      this.tendermintClient
    ]).then(()=>new Validator({ address }).fetchDetails(this))
  }
}
