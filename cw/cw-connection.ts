import { Core, Chain, Code, Deploy } from '@fadroma/agent'
import type { Address, Message, CodeId, CodeHash, Token } from '@fadroma/agent'
import { CosmWasmClient, SigningCosmWasmClient, serializeSignDoc } from '@hackbg/cosmjs-esm'
import type { Block, StdFee } from '@hackbg/cosmjs-esm'
import type { CWMnemonicIdentity, CWSignerIdentity } from './cw-identity'
import { CWConsole as Console, CWError as Error, bold, assign } from './cw-base'

const assertApi =
  ({ api }: { api?: CWConnection["api"] }): NonNullable<CWConnection["api"]> => {
    if (!api) {
      throw new Error('no api')
    }
    return api
  }

/** Generic agent for CosmWasm-enabled chains. */
export class CWConnection extends Chain.Connection {
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** API connects asynchronously, so API handle is a promise of either variant. */
  declare api: Promise<CosmWasmClient|SigningCosmWasmClient>
  /** A supported method of authentication. */
  declare identity: CWMnemonicIdentity|CWSignerIdentity

  constructor (properties: Partial<CWConnection>) {
    super(properties)
    assign(this, properties, [ 'coinType', 'bech32Prefix', 'hdAccountIndex' ])
    this.log.label = [this.chainId, this.address].filter(Boolean).join(': ')
    if (this.url) {
      if (this.identity?.signer) {
        this.log.debug('Connecting\n  to', bold(this.url), this.chainId, '\n  as', bold(this.address), this.identity?.name||'')
        this.api = SigningCosmWasmClient.connectWithSigner(this.url, this.identity.signer)
      } else {
        this.log.debug('Connecting anonymously\n  to', bold(this.url))
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
    token:   string = this.defaultDenom,
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

  doGetCodes () {
    const codes: Record<CodeId, Deploy.UploadedCode> = {}
    return assertApi(this)
      .then(api=>api.getCodes())
      .then(results=>{
        for (const { id, checksum, creator } of results||[]) {
          codes[id!] = new Deploy.UploadedCode({
            chainId:  this.chainId,
            codeId:   String(id),
            codeHash: checksum,
            uploadBy: creator
          })
        }
        return codes
      })
  }

  /** Stargate implementation of getting a code id. */
  doGetCodeId (address: Address): Promise<CodeId> {
    return assertApi(this)
      .then(api=>api.getContract(address))
      .then(({codeId})=>String(codeId))
  }

  doGetContractsByCodeId (id: CodeId): Promise<Iterable<{address: Address}>> {
    return assertApi(this)
      .then(api=>api.getContracts(Number(id)))
      .then(addresses=>addresses.map(address=>({address})))
  }

  /** Stargate implementation of getting a code hash. */
  doGetCodeHashOfAddress (address: Address): Promise<CodeHash> {
    return assertApi(this)
      .then(api=>api.getContract(address))
      .then(({codeId})=>this.doGetCodeHashOfCodeId(String(codeId)))
  }

  /** Stargate implementation of getting a code hash. */
  doGetCodeHashOfCodeId (codeId: CodeId): Promise<CodeHash> {
    return assertApi(this)
      .then(api=>api.getCodeDetails(Number(codeId)))
      .then(({checksum})=>checksum)
  }

  /** Stargate implementation of getting a contract label. */
  async getLabel (address: Address): Promise<string> {
    if (!address) {
      throw new Error('chain.getLabel: no address')
    }
    const { label } = await assertApi(this).then(api=>api.getContract(address))
    return label
  }

  /** Stargate implementation of sending native token. */
  async doSend (
    recipient: Address,
    amounts:   Token.ICoin[],
    options?:  Parameters<Chain.Connection["doSend"]>[2]
  ) {
    return assertApi(this).then(api=>{
      if (!(api as SigningCosmWasmClient)?.sendTokens) {
        throw new Error("can't send tokens with an unauthenticated agent")
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
    options?: Parameters<Chain.Connection["doSendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  async doUpload (data: Uint8Array): Promise<Partial<Deploy.UploadedCode>> {
    if (!this.address) {
      throw new Error("can't upload contract without sender address")
    }
    return assertApi(this)
      .then(api=>{
        if (!(api as SigningCosmWasmClient)?.upload) {
          throw new Error("can't upload contract with an unauthenticated agent")
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
    codeId: CodeId, options: Parameters<Chain.Connection["doInstantiate"]>[1]
  ): Promise<Partial<Deploy.ContractInstance>> {
    if (!this.address) {
      throw new Error("can't instantiate contract without sender address")
    }
    const api = await assertApi(this)
    if (!(api as SigningCosmWasmClient)?.instantiate) {
      throw new Error("can't instantiate contract without authorizing the agent")
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
    contract: { address: Address }, message: Message, {
      execSend,
      execMemo,
      execFee = this.fees?.exec || 'auto'
    }: Omit<NonNullable<Parameters<Chain.Connection["execute"]>[2]>, 'execFee'> & {
      execFee?: Token.IFee | number | 'auto'
    } = {}
  ): Promise<unknown> {
    if (!this.address) {
      throw new Error("can't execute transaction without sender address")
    }
    return assertApi(this).then(api=>{
      if (!(api as SigningCosmWasmClient)?.execute) {
        throw new Error("can't execute transaction without authorizing the agent")
      }
      return (api as SigningCosmWasmClient).execute(
        this.address!, contract.address, message, execFee, execMemo, execSend
      )
    })
  }

  /** Stargate implementation of querying a smart contract. */
  async doQuery <U> (
    contract: Address|{ address: Address }, message: Message
  ): Promise<U> {
    if (typeof contract === 'string') {
      contract = { address: contract }
    }
    if (!contract.address) {
      throw new Error('no contract address')
    }
    return assertApi(this).then(api=>{
      return api.queryContractSmart((contract as { address: Address }).address, message) as U
    })
  }

  batch (): Chain.Batch<this> {
    return new CWBatch({ connection: this }) as unknown as Chain.Batch<this>
  }
}

/** Transaction batch for CosmWasm-enabled chains. */
export class CWBatch extends Chain.Batch<CWConnection> {
  upload (
    code:    Parameters<Chain.Batch<Chain.Connection>["upload"]>[0],
    options: Parameters<Chain.Batch<Chain.Connection>["upload"]>[1]
  ) {
    return this
  }
  instantiate (
    code:    Parameters<Chain.Batch<Chain.Connection>["instantiate"]>[0],
    options: Parameters<Chain.Batch<Chain.Connection>["instantiate"]>[1]
  ) {
    return this
  }
  execute (
    contract: Parameters<Chain.Batch<Chain.Connection>["execute"]>[0],
    options:  Parameters<Chain.Batch<Chain.Connection>["execute"]>[1]
  ) {
    return this
  }
  async submit () {}
}
