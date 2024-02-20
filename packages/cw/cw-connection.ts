import { Core, Chain, Deploy } from '@fadroma/agent'
import type { Address, Message, CodeId, CodeHash, Token } from '@fadroma/agent'
import type { CWMnemonicIdentity, CWSignerIdentity } from './cw-identity'
import { CWConsole as Console, CWError as Error, bold, assign } from './cw-base'
import { ripemd160 } from "@noble/hashes/ripemd160"
import { sha256 } from "@noble/hashes/sha256"

import { API, Amino, Cosmos } from '@hackbg/cosmjs-esm'

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
  declare api: Promise<API.CosmWasmClient|API.SigningCosmWasmClient>
  /** A supported method of authentication. */
  declare identity: CWMnemonicIdentity|CWSignerIdentity

  constructor (properties: Partial<CWConnection>) {
    super(properties)
    assign(this, properties, [ 'coinType', 'bech32Prefix', 'hdAccountIndex' ])
    if (this.url) {
      if (this.identity?.signer) {
        this.log.debug('Connecting via', bold(this.url))
        this.api = API.SigningCosmWasmClient.connectWithSigner(this.url, this.identity.signer)
      } else {
        this.log.debug('Connecting anonymously via', bold(this.url))
        this.api = API.CosmWasmClient.connect(this.url)
      }
    } else {
      this.log.warn('No connection url.')
    }
  }

  doGetBlockInfo (): Promise<API.Block> {
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
      if (!(api as API.SigningCosmWasmClient)?.sendTokens) {
        throw new Error("can't send tokens with an unauthenticated agent")
      }
      return (api as API.SigningCosmWasmClient).sendTokens(
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
        if (!(api as API.SigningCosmWasmClient)?.upload) {
          throw new Error("can't upload contract with an unauthenticated agent")
        }
        return (api as API.SigningCosmWasmClient).upload(
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
    if (!(api as API.SigningCosmWasmClient)?.instantiate) {
      throw new Error("can't instantiate contract without authorizing the agent")
    }
    const result = await (api as API.SigningCosmWasmClient).instantiate(
      this.address!,
      Number(codeId),
      options.initMsg,
      options.label!,
      options.initFee as Amino.StdFee || 'auto',
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
      if (!(api as API.SigningCosmWasmClient)?.execute) {
        throw new Error("can't execute transaction without authorizing the agent")
      }
      return (api as API.SigningCosmWasmClient).execute(
        this.address!, contract.address, message, execFee, execMemo, execSend
      )
    })
  }

  /** Call a query method of a contract. */
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

  /** Handle to the API's internal query client. */
  get qClient (): Promise<ReturnType<API.CosmWasmClient["getQueryClient"]>> {
    return Promise.resolve(this.api).then(api=>(api as any)?.queryClient)
  }

  /** Handle to the API's internal Tendermint transaction client. */
  get txClient (): Promise<ReturnType<API.CosmWasmClient["getTmClient"]>> {
    return Promise.resolve(this.api).then(api=>(api as any)?.tmClient)
  }

  /** Return a list of validators for this chain. */
  getValidators ({
    metadata = true,
    prefix   = this.bech32Prefix,
  }: {
    metadata?: boolean
    prefix?:   string
  } = {}) {
    const { log } = this
    return assertApi(this).then(async api=>{
      const client = await this.txClient
      let {blockHeight, total, validators} = await client.validatorsAll();
      // Warn on count mismatch.
      if (validators.length < total) {
        this.log.warn(`Failed to fetch all validators! Fetched ${validators.length} out of ${total}`)
      }
      if (validators.length > total) {
        this.log.warn(`Fetched too many validators?! Fetched ${validators.length} but total is ${total}`)
      }
      // Sort validators by voting power in descending order.
      validators = [...validators].sort((a,b)=>(
        (a.votingPower < b.votingPower) ?  1 :
        (a.votingPower > b.votingPower) ? -1 : 0
      ))
      const result = []
      for (let validator of validators) {
        const address = Core.bech32.encode(
          prefix,
          Core.bech32.toWords(ripemd160(Core.sha256(validator.pubkey.data)))
        )
        const info = {
          address,
          addressHex:       Core.base16.encode(validator.address),
          pubKeyHex:        Core.base16.encode(validator.pubkey.data),
          votingPower:      validator.votingPower,
          proposerPriority: validator.proposerPriority,
        }
        result.push(info)
        if (metadata) {
          const metadataResult = await this.getValidatorMetadata(address)
          console.log({metadataResult})
        }
      }
      return result
    })
  }

  getValidatorMetadata (address: Address) {
    const { log } = this
    return assertApi(this).then(async api=>{
      const client = await this.qClient
      const { value } = await client.queryAbci(
        '/cosmos.staking.v1beta1.Query/Validator',
        Cosmos.Staking.v1beta1.Query.QueryValidatorRequest.encode({
          validatorAddr: address
        }).finish()
      )
      return Cosmos.Staking.v1beta1.Query.QueryValidatorResponse.decode(value)
    })
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
