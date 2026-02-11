/**
  Fadroma Scrt
  Copyright (C) 2023-2026 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import Tendermint from '../Tendermint/Tendermint.ts';
import CosmWasm   from '../CosmWasm/CosmWasm.ts';
export default SecretNetwork;
function SecretNetwork () {};
interface SecretNetwork {};
namespace SecretNetwork {
  export class Error extends Tendermint.Error {}
  export class Console extends Tendermint.Console { override label = '@fadroma/scrt' }
  export const console = new Console();
  /** Represents a Secret Network API endpoint. */
  export interface Connection extends Tendermint.Connection {
    /** Underlying API client. */
    api: SecretNetworkClient
  }
  export interface Chain extends Tendermint.Chain {
    connect (options: { id?: string, urls?: (string|URL)[] }): Chain,
    getConnection: () => Connection,
    authenticate:  (...args: unknown[]) => Promise<Agent>,
    fetchLimits:   () => Promise<{ gas: number }>,
    connections:   Connection[],
  }
  /** Represents the dependencies of the API methods. */
  export interface Context extends Tendermint.Context {
    withIntoError <T>(p: Promise<T>): Promise<T>
    api: SecretNetworkClient,
  }
  export interface AgentContext extends Context {
    agent:   Agent,
    address: Address,
    wallet:  Wallet,
    fees: {
      upload: Tendermint.Fee,
      init:   Tendermint.Fee,
      exec:   Tendermint.Fee,
      send:   Tendermint.Fee
    },
  }
  export interface Block extends Tendermint.Block {}
  export interface Identity {
    getApi ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient
    wallet?: Wallet,
    address?: Address,
    encryptionUtils?: EncryptionUtils
  }
  export interface Agent extends Tendermint.Agent {
    log:      Console,
    address:  Address,
    chain:    () => Core.ChainRef,
    identity: Identity,
    /** Set permissive fees by default. */
    fees: { upload: Tendermint.Fee, init: Tendermint.Fee, exec: Tendermint.Fee, send: Tendermint.Fee },
    setMaxGas: () => Promise<void>,
    account: ReturnType<SecretNetworkClient['query']['auth']['account']>,
    getNonce: () => Promise<{ accountNumber: number, sequence: number }>,
    encrypt: (codeHash: CosmWasm.CodeHash, msg: CosmWasm.Message) => any,
  }
  /** Smallest unit of native token. */
  export const gasToken = Tendermint.makeToken({
    id:    'uscrt',
    denom: 'uscrt',
    native: true,
    fungible: true,
  })
  export const fromKeplr = () => { throw new Error('unimplemented') }
  export const fromMnemonic = (
    mnemonic = Bip39.generateMnemonic(Bip39EN),
    wallet   = new Wallet(mnemonic),
  ): Identity => ({
    wallet,
    address: wallet.address,
    getApi: ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient =>
      new SecretNetworkClient({
        chainId,
        url: url.toString(),
        wallet,
        walletAddress: wallet.address,
      })
  })
  export const fromSigner = (encryptionUtils: EncryptionUtils): Identity => ({
    encryptionUtils,
    getApi: ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient =>
      new SecretNetworkClient({
        chainId,
        url: url.toString(),
        encryptionUtils,
      })
  })
  export const agent = (config: { log: Console, identity: Identity|EncryptionUtils|string }) => {
    if (!config.identity) throw new Error('identity must be Identity instance, { mnemonic }, or { encryptionUtils }')
    if (typeof config.identity === 'string') {
      config.log.debug('Identifying with mnemonic')
      config.identity = fromMnemonic(config.identity)
    } else if ('encryptionUtils' in config.identity) {
      config.log.debug('Identifying with signer (encryptionUtils)')
      config.identity = fromSigner(config.identity.encryptionUtils!)
    } else {
      throw new Error('identity must be Identity instance, { mnemonic }, or { encryptionUtils }')
    }
    //config.#connection = new SigningConnection({ chain: config.chain, identity: config.identity })
  }
  //export type SigningConnection = {
    //api: SecretNetworkClient,
    //get identity (): Identity,
    //send: (...args: Parameters<SigningConnection["send"]>) => Promise<unknown>,
    //upload: (...args: Parameters<SigningConnection["upload"]>) => Promise<unknown>,
    //instantiate: (...args: Parameters<SigningConnection["instantiate"]>) => Promise<unknown>,
    //execute: <T> (...args: Parameters<SigningConnection["execute"]>) => Promise<T>,
  //}
  //
  const chainMethods = (api: any) => Object.assign(api, {
    withIntoError: <T>(p: Promise<T>): Promise<T> => p.catch(api.intoError),
    intoError: async (e: object) => {
      e = await Promise.resolve(e)
      api.error(e)
      throw Object.assign(new Error(), e)
    },
    getConnection: (): Connection => {
      const [connection] = api.connections || []
      if (!connection) {
        throw new Error('no available connections.')
      }
      return connection
    },
    connect: ({ id, urls = [] }: { id: Core.ChainId, urls: (string|URL)[] }): Chain => {
      Error.TODO('scrt.connect')
      const chain = Tendermint.chain({ id }) as Chain
      //const connections = urls.map(url=>new Connection({ chain, url: url.toString() }))
      //chain.connections = connections
      return chain
    },
    authenticate: async (...args: unknown[]): Promise<Agent> => {
      Error.TODO('scrt.authenticate')
      return {} as unknown as Agent
      //if (args.length === 0) {
        //return new Agent({ chain: api, api: new SecretNetworkClient({ chainId: chain.id, url: chain.getConnection().url }) })
      //} else {
        //throw new Error("unimplemented!")
      //}
    },
    fetchLimits: (): Promise<{ gas: number }> =>
      api.api.query.params.params({ subspace: "baseapp", key: "BlockParams" }).then(
        ({param}: {param:{value:string}})=>{
          let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
          api.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
          if (max_gas < 0) {
            max_gas = 10000000
            api.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
          }
          return { gas: max_gas }
        }),
  })

  export const connectionMethods = (api: SecretNetworkClient) => ({
    fetchBalance:       Bank.fetchBalance,
    fetchCodeInfo:      Compute.fetchCodeInfo,
    fetchCodeInstances: Compute.fetchCodeInstances,
    fetchContractInfo:  Compute.fetchContractInfo,
    query:              Compute.query,
    fetchBlock: async (parameter?: unknown): Promise<Block> => {
      if (!parameter) {
        let {
          block_id: { hash, part_set_header } = {},
          block: { header, data, evidence, last_commit } = {}
        } = await api.query.tendermint.getLatestBlock({})
        if (hash instanceof Uint8Array) {
          hash = base16.encode(hash) as any
        }
        return {
          id: hash as any,
          height: Number(header?.height)
        } as Block
      } else {
        throw new Error('todo')
      }
    },
    //constructor: (properties?: Partial<Connection>) => {
      ////super(properties as Partial<Connection>)
      //api.api ??= new SecretNetworkClient({ url: api.url!, chainId: api.chainId!, })
      //const {chainId, url} = api
      //if (!chainId) {
        //throw new Error("can't authenticate without chainId")
      //}
      //if (!url) {
        //throw new Error("can't connect without url")
      //}
      //api.api = new SecretNetworkClient({ chainId, url })
    //},
  })

  export const agentMethods = (chain: Chain, agent: Agent, api: SecretNetworkClient) => ({
    batch: (): Batch.Batch => Batch.batch(agent),
    fees: {
      upload: gasToken.fee(10000000),
      init:   gasToken.fee(10000000),
      exec:   gasToken.fee(1000000),
      send:   gasToken.fee(1000000),
    },
    setMaxGas: async (deps: AgentContext, gas?: Uint128) => {
      gas ??= (await chain.fetchLimits()).gas
      const max = gasToken.fee(gas)
      deps.fees = { upload: max, init: max, exec: max, send: max }
      return deps
    },
    get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
      return api.query.auth.account({ address: agent.address })
    },
    async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
      const result: any = await this.account ?? (() => {
        throw new Error(`Cannot find account "${agent.address}", make sure it has a balance.`)
      })()
      const { account_number, sequence } = result.account
      return { accountNumber: Number(account_number), sequence: Number(sequence) }
    },
    async encrypt (codeHash: CosmWasm.CodeHash, msg: CosmWasm.Message) {
      if (!codeHash) {
        throw new Error("can't encrypt message without code hash")
      }
      const { encryptionUtils } = api as any
      const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
      return base64.encode(encrypted)
    },
  })

  export const signingConnectionMethods = (identity: Identity, chainId: ChainId, url: string|URL) => ({
    identity,
    api:         identity.getApi({ chainId, url }),
    send:        Bank.send,
    upload:      Compute.upload,
    instantiate: Compute.instantiate,
    execute:     Compute.query,
  })

  export namespace Bank {

    export async function fetchBalance ({ api, withIntoError }: Context, args: {
      parallel?: boolean, addresses: Address[]
    }) {
      const { parallel = false, addresses } = args
      const queries = []
      for (const [address, tokens] of Object.entries(addresses)) {
        for (const denom of tokens) {
          queries.push(()=>withIntoError(api.query.bank.balance({ address, denom }))
            .then(response=>({ address, token: denom, balance: response.balance })))
        }
      }
      const result: Record<Address, Record<string, string>> = {}
      type Response = {address: string, token: string, balance?: { amount?: string }}
      const responses: Array<Response> = await optionallyParallel(parallel, queries)
      for (const { address, token, balance } of responses) {
        result[address] ??= {}
        result[address][token] = balance?.amount!
      }
      return result
    }

    export async function send ({ address, api, withIntoError }: AgentContext, args: {
      parallel?: boolean, outputs: Record<Address, Coin[]>, sendFee: Fee, sendMemo?: string
    }) {
      const { parallel = false, outputs, sendFee, sendMemo } = args
      const sender = address
      const transactions = []
      for (const [recipient, amounts] of Object.entries(outputs)) {
        const amount = amounts.map(({amount, denom})=>({ amount: String(amount), denom }))
        const args = { from_address: sender, to_address: recipient, amount }
        const opts = { gasLimit: Number(sendFee?.gas) }
        const fmt  = (transaction: unknown)=>({sender, recipient, amounts: amount, transaction})
        const tx   = ()=>withIntoError(api.tx.bank.send(args, opts)).then(fmt)
        transactions.push(tx)
      }
      type Response = {
        sender: Address,
        recipient: Address,
        amounts: Coin[],
        transaction: unknown
      }
      const result: Record<Address, Response> = {}
      const responses: Array<Response> = await optionallyParallel(parallel, transactions)
      for (const response of responses) result[(response).recipient] = response
      return result
      //return withIntoError(api.tx.bank.send(
        //{ from_address: this.address!, to_address: recipient, amount: amounts },
        //{ gasLimit: Number(options?.sendFee?.gas) }
      //))
    }
  }

  export namespace Batch {
    export type Batch = Tendermint.Batch & {
      /** Messages to encrypt. */
      messages: Array<BatchMessage>
    }
    export type BatchMessage =
      |InstanceType<typeof MsgStoreCode>
      |InstanceType<typeof MsgInstantiateContract>
      |InstanceType<typeof MsgExecuteContract>
    export type BatchContext = Batch & {
      log:   Console,
      agent: Agent,
      chain: () => ChainRef
      api?:  SecretNetworkClient,
      fees?: Tendermint.FeeMap<'upload'|'init'|'exec'|'send'>
    }
    export type BatchResult = {
      sender?:   Address
      tx:        Hash
      type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
      chainId:   ChainId
      codeId?:   CodeId
      codeHash?: CodeHash
      address?:  Address
      label?:    Label
    }
    export const batch = (agent: Agent, api?: SecretNetworkClient): BatchContext => {
      const batch: BatchContext = {
        log:   agent.log,
        chain: agent.chain,
        agent,
        api,
        messages: [],
        add: (): Batch & BatchContext => batch,
        submit: (_agent: Agent) => { throw new Error('todo') },
      }
      return batch
    }
    /** TODO: Upload in batch. */
    export const uploadInBatch = (_deps: BatchContext, _code: never, _options: never) => {
      throw new Error('Batch#upload: not implemented')
      return this
    }
    export const instantiateInBatch = (
      { agent, messages }: BatchContext,
      code: CodeId,
      options: { label: Label, initMsg: Message, initSend: Coin[] },
    ) => {
      messages.push(new MsgInstantiateContract({
        //callback_code_hash: '',
        //callback_sig:       null,
        sender:     agent!.address!,
        code_id:    code,
        label:      options.label!,
        init_msg:   options.initMsg,
        init_funds: options.initSend,
      }))
      return this
    }
    export const executeInBatch = (
      { agent, messages }: BatchContext,
      contract: Address|{ address: Address },
      message:  Message,
      options:  { execSend: Coin[] },
    ) => {
      if (typeof contract === 'object') contract = contract.address!
      messages.push(new MsgExecuteContract({
        //callback_code_hash: '',
        //callback_sig:       null,
        sender:           agent!.address!,
        contract_address: contract,
        sent_funds:       options?.execSend,
        msg:              message as object,
      }))
      return this
    }
    /** Format the messages for API v1 like secretjs and encrypt them. */
    export const encryptBatch = ({ agent, messages = [] }: BatchContext): Promise<any[]> =>
      Promise.all(messages.map((message: object) => {
        switch (true) {
          case (message instanceof MsgStoreCode):           return encryptUpload(message)
          case (message instanceof MsgInstantiateContract): return encryptInit(agent, message as any)
          case (message instanceof MsgExecuteContract):     return encryptExec(agent, message as any)
          default: throw new Error(`unsupported batch message: ${message}`)
        }
      }))
    export const encryptUpload = async (upload: any): Promise<any> =>
      { throw new Error('not implemented') }
    export const encryptInit = async (agent: Agent, init: {
      codeId:   CodeId,
      codeHash: CodeHash,
      label:    Label
      msg:      Message,
      funds:    Coin[],
    }) => ({
      "@type":      "/secret.compute.v1beta1.MsgInstantiateContract",
      sender:       agent.address,
      code_id:      String(init.codeId),
      init_funds:   init.funds,
      label:        init.label,
      init_msg:     await agent.encrypt(init.codeHash, init.msg),
      callback_sig: null,
      callback_code_hash: '',
    })
    export const encryptExec = async (agent: Agent, exec: {
      sender:   Address,
      contract: Address,
      codeHash: CodeHash,
      msg:      Message,
      funds:    Coin[]
    }) => ({
      "@type":      '/secret.compute.v1beta1.MsgExecuteContract',
      sender:       agent.address,
      contract:     exec.contract,
      sent_funds:   exec.funds,
      msg:          await agent.encrypt(exec.codeHash, exec.msg),
      callback_sig: null,
      callback_code_hash: '',
    })
    const simulateBatch = ({ api, messages }: BatchContext) =>
      Promise.resolve(api).then(api=>api!.tx.simulate(messages))
    const submitBatch = async ({ chain, api, fees, messages, agent, log }: BatchContext, { memo = "" }: { memo: string }): Promise<BatchResult[]> => {
      //const api = await Promise.resolve(batch.chain!.api)
      const chainId  = chain().id
      const limit    = Number(fees?.exec?.amount[0].amount) || undefined
      const gas      = messages.length * (limit || 0)
      const results: BatchResult[] = []
      try {
        const txResult = await api!.tx.broadcast(messages as any, { gasLimit: gas })
        if (txResult.code !== 0) {
          const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
          throw Object.assign(new Error(error), txResult)
        }
        for (const i in messages) {
          const msg    = messages[i]
          const sender = agent.address
          const tx     = txResult.transactionHash
          const result: Partial<BatchResult> = { chainId, sender, tx, }
          if (msg instanceof MsgInstantiateContract) {
            const findAddr = ({msg, type, key}: { msg: number, type: string, key: string }) =>
              msg  ==  Number(i) &&
              type === "message" &&
              key  === "contract_address"
            results[Number(i)] = Object.assign(result, {
              type:    'wasm/MsgInstantiateContract',
              codeId:  msg.codeId,
              label:   msg.label,
              address: txResult.arrayLog?.find(findAddr)?.value,
            }) as BatchResult
          } else if (msg instanceof MsgExecuteContract) {
            results[Number(i)] = Object.assign(result, {
              type:    'wasm/MsgExecuteContract',
              address: msg.contractAddress
            }) as BatchResult
          }
        }
      } catch (error: any) {
        log.br()
          .error('submitting batch failed:')
          .error(bold(error.message))
          .warn('(decrypting batch errors is not implemented)')
        throw error
      }
      return results
    }
    /** Format the messages for API v1beta1 like secretcli and generate a multisig-ready
      * unsigned transaction batch; don't execute it, but save it in
      * `state/$CHAIN_ID/transactions` and output a signing command for it to the console. */
    const saveBatch = async ({ log, agent, chain, messages: encryptedMessages }: BatchContext, name?: string) => {
      // Number of batch, just for identification in console
      name ??= name || `TX.${+new Date()}`
      // Get signer's account number and sequence via the canonical API
      const { accountNumber, sequence } = await agent!.getNonce()//chain.url, chain!.address)
      // Print the body of the batch
      log.debug(`Messages in batch:`)
      for (const msg of encryptedMessages??[]) {
        log.debug(' ', JSON.stringify(msg))
      }
      // The base Batch class stores messages as (immediately resolved) promises
      const messages = await encryptedMessages
      // Print the body of the batch
      log.debug(`Encrypted messages in batch:`)
      for (const msg of messages??[]) {
        log.info(' ', JSON.stringify(msg))
      }
      // Compose the plaintext
      const unsigned = composeUnsignedTx(messages, name)
      // Output signing instructions to the console
      const output = `${name}.signed.json`
      const string = JSON.stringify(unsigned)
      const txdata = shellescape([string])

      log
        .br()
        .info('Multisig batch ready.')
        .info(`Run the following command to sign the batch:
    \nsecretcli tx sign /dev/stdin --output-document=${output} \\
    --offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${agent!.address} \\
    --chain-id=${chain().id} --account-number=${accountNumber} --sequence=${sequence} \\
    <<< ${txdata}`)
        .br()
        .debug(`Batch contents:`, JSON.stringify(unsigned, null, 2))
        .br()

      return {
        name,
        accountNumber,
        sequence,
        unsignedTxBody: JSON.stringify(unsigned)
      }
    }
    const composeUnsignedTx = (encryptedMessages: any[], memo?: string): any => {
      const gas = 10000000
      const fee = { amount: [Tendermint.makeCoin(gas, 'uscrt')], gas: 10000000 }
      const auth_info = { signer_infos: [], fee: { ...fee, gas: fee.gas, payer: "", granter: "" }, }
      const body = { memo, messages: encryptedMessages, timeout_height: "0", extension_options: [], non_critical_extension_options: [] }
      return { auth_info, signatures: [], body }
    }
    const shellescape = (a: string[]) => {
      const ret: string[] = [];
      for (let s of a) {
        if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
          s = "'"+s.replace(/'/g,"'\\''")+"'"
          s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
            .replace(/\\'''/g, "\\'" ) // remove non-escaped single-quote if there are enclosed between 2 escaped
        }
        ret.push(s)
      }
      return ret.join(' ')
    }
  }

  export namespace Compute {
    export const fetchCodeInfo = async (
      { chain, api, withIntoError }: Context,
      filter?: CodeId[]
    ): Promise<Record<CodeId, UploadedCode>> => {
      const result: Record<CodeId, UploadedCode> = {}
      await withIntoError(api.query.compute.codes({})).then(({code_infos})=>{
        for (const { code_id, code_hash, creator } of code_infos||[]) {
          if (!filter || filter.includes(code_id!)) result[code_id!] = {
            chain:    chain(),
            codeId:   code_id,
            codeHash: code_hash,
            uploadBy: creator
          } as UploadedCode
        }
      })
      return result
    }
    export const fetchCodeInstances = async (
      { chain, api, log, withIntoError }: Context, codeIds: Iterable<CodeId>, parallel?: boolean
    ): Promise<Record<CodeId, Record<Address, Contract>>> => {
      if (parallel) log.warn('fetchCodeInstances in parallel: not implemented')
      const result: Record<CodeId, Record<Address, Contract>> = {}
      for (const [codeId, Contract] of Object.entries(codeIds)) {
        let codeHash: string
        const instances = {}
        await withIntoError(api.query.compute.codeHashByCodeId({ code_id: codeId }))
          .then(({code_hash})=>codeHash = code_hash!)
        await withIntoError(api.query.compute.contractsByCodeId({ code_id: codeId }))
          .then(({contract_infos})=>{
            for (const { contract_address, ContractInfo: { label, creator } = {}} of contract_infos!) {
              result[codeId] ??= {}
              result[codeId][contract_address!] = {
                chain: chain(),
                codeId,
                codeHash,
                label,
                address: contract_address,
                initBy:  creator
              } as Contract
            }
          })
        result[codeId] = instances
      }
      return result
    }
    export const fetchContractInfo = async (
      { chain, api, log, withIntoError }: Context,
      args: { parallel?: boolean, contracts: Record<Address, unknown> },
    ): Promise<{
      [address in keyof typeof args["contracts"]]: Contract
    }> => {
      if (args.parallel) log.warn('fetchContractInfo in parallel: not implemented')
      throw new Error('unimplemented!')
      //protected override async fetchCodeHashOfAddressImpl (contract_address: Address): Promise<CodeHash> {
        //return (await withIntoError(this.api.query.compute.codeHashByContractAddress({
          //contract_address
        //})))
          //.code_hash!
      //}

      //async getLabel (contract_address: Address): Promise<Chain.Label> {
        //return (await withIntoError(this.api.query.compute.contractInfo({
          //contract_address
        //})))
          //.ContractInfo!.label!
      //}
    }
    export const query = async (deps: Context, args: {
      address:  Address,
      codeHash: CodeHash,
      message:  Message,
    }) => {
      const { withIntoError } = deps
      const api = await Promise.resolve(deps.api)
      return withIntoError(api.query.compute.queryContract({
        contract_address: args.address,
        code_hash:        args.codeHash,
        query:            args.message as Record<string, unknown>
      }))
    }
    export const upload = async (deps: AgentContext, args: { binary: Uint8Array }) => {
      const { chain, api, address, fees, log, withIntoError } = deps
      const gasLimit = Number(fees.upload?.amount[0].amount) || undefined
      const result = await withIntoError(api.tx.compute.storeCode({
        sender:         address,
        wasm_byte_code: args.binary,
        source:         "",
        builder:        ""
      }, { gasLimit }))
      const {
        code,
        message,
        details = [],
        rawLog
      } = result as typeof result & { message?: any, details?: any[] }
      if (code !== 0) {
        log.error(
          `Upload failed with code ${bold(code)}:`,
          bold(message ?? rawLog ?? ''),
          ...details
        )
        if (message === `account ${address} not found`) {
          log.info(`If this is a new account, send it some SCRT first.`)
          const chainId = chain().id
          if (faucets[chainId]) {
            log.info(`Available faucets\n `, [...faucets[chainId]].join('\n  '))
          }
        }
        log.error(`Upload failed`, { result })
        throw new Error('upload failed')
      }
      type Log = { type: string, key: string }
      const codeId = result.arrayLog
        ?.find((log: Log) => log.type === "message" && log.key === "code_id")
        ?.value
      if (!codeId) {
        log.error(`Code ID not found in result`, { result })
        throw new Error('upload failed')
      }
      const { codeHash } = (await fetchCodeInfo(deps, [codeId]))[codeId]
      return {
        chain: chain(),
        codeId,
        codeHash:  codeHash!,
        uploadBy:  address,
        uploadTx:  result.transactionHash,
        uploadGas: result.gasUsed
      } as UploadedCode
    }
    export const instantiate = async ({ chain, api, address, log, fees, withIntoError }: AgentContext, args: {
      codeId:    CodeId, 
      codeHash:  CodeHash,
      label:     Label,
      initMsg:   Message, 
      initSend:  Coin[],
      initMemo?: string
    }) => {
      const parameters = {
        sender:     address,
        code_id:    Number(args.codeId),
        code_hash:  args.codeHash,
        label:      args.label!,
        init_msg:   args.initMsg,
        init_funds: args.initSend.map(({ amount, denom })=>({ amount: String(amount), denom })),
        memo:       args.initMemo
      }
      const instantiateOptions = {
        gasLimit: Number(fees.init?.amount[0].amount) || undefined
      }
      const result = await withIntoError(
        api.tx.compute.instantiateContract(parameters, instantiateOptions)
      )
      if (result.code !== 0) {
        log.error('Init failed:', { parameters, instantiateOptions, result })
        throw new Error(`init of code id ${args.codeId} failed`)
      }
      return {
        chain: chain(),
        address:  result.arrayLog!.find(
          ({ type, key }: { type: string, key: string }) =>
            type === "message" && key === "contract_address"
        )?.value!,
        codeHash: args.codeHash,
        initBy:   address,
        initTx:   result.transactionHash,
        initGas:  result.gasUsed,
        label:    args.label,
      } as Contract & { address: Address }
    }
    export const execute = async ({ api, log, address }: AgentContext, args: {
      address:      Address,
      codeHash:     CodeHash,
      message:      Message,
      execSend?:    Coin[],
      execFee?:     Fee,
      execMemo?:    string,
      preSimulate?: boolean
    }) => {
      const tx = {
        sender:           address!,
        contract_address: args.address,
        code_hash:        args.codeHash,
        msg:              args.message as Record<string, unknown>,
        sentFunds:        args.execSend
      }
      const txOpts = {
        gasLimit: Number(args.execFee?.gas) || undefined
      }
      if (args.preSimulate) {
        log.info('Simulating transaction...')
        let simResult
        try {
          simResult = await api.tx.compute.executeContract.simulate(tx, txOpts)
        } catch (e) {
          log.error(e)
          log.warn('TX simulation failed:', tx, 'from', address)
        }
        const gas_used = simResult?.gas_info?.gas_used
        if (gas_used) {
          log.info('Simulation used gas:', gas_used)
          const gas = Math.ceil(Number(gas_used) * 1.1)
          // Adjust gasLimit up by 10% to account for gas estimation error
          log.info('Setting gas to 110% of that:', gas)
          txOpts.gasLimit = gas
        }
      }
      const result = await api.tx.compute.executeContract(tx, txOpts)
      // check error code as per https://grpc.github.io/grpc/core/md_doc_statuscodes.html
      if (result.code !== 0) {
        throw decodeError(result)
      }
      return result as TxResponse
    }
    export const decodeError = (result: TxResponse) => {
      const error = `scrt execute: gRPC error ${result.code}: ${result.rawLog}`
      // make the original result available on request
      const original = structuredClone(result)
      Object.defineProperty(result, "original", {
        enumerable: false, get () { return original }
      })
      // decode the values in the result
      const txBytes = tryDecode(result.tx as Uint8Array)
      Object.assign(result, { txBytes })
      for (const i in result.tx.signatures) {
        Object.assign(result.tx.signatures, { [i]: tryDecode(result.tx.signatures[i as any]) })
      }
      for (const event of result.events) {
        for (const attr of event?.attributes ?? []) {
          try { attr.key   = tryDecode(attr.key)   } catch (_e) { /* */ }
          try { attr.value = tryDecode(attr.value) } catch (_e) { /* */ }
        }
      }
      return Object.assign(new Error(error), result)
    }
    /** Used to decode Uint8Array-represented UTF8 strings in TX responses. */
    const decoder = new TextDecoder('utf-8', { fatal: true })
    /** Marks a response field as non-UTF8 to prevent large binary arrays filling the console. */
    export const nonUtf8 = Symbol('(binary data, see result.original for the raw Uint8Array)')
    /** Decode binary response data or mark it as non-UTF8 */
    const tryDecode = (data: Uint8Array): string|symbol => {
      try {
        return decoder.decode(data)
      } catch (_e) {
        return nonUtf8
      }
    }
  }

  export const chainIds = {
    mainnet: 'secret-4',
    testnet: 'pulsar-3',
  }
  export function connect (...args: Parameters<typeof Chain["connect"]>) {
    if (!args[0]) args[0] = {} as any
    return Chain.connect(...args)
  } 
  /** See https://docs.scrt.network/secret-network-documentation/development/resources-api-contract-addresses/connecting-to-the-network/mainnet-secret-4#api-endpoints */
  export const mainnets = new Set([
    'https://lcd.mainnet.secretsaturn.net',
    'https://lcd.secret.express',
    'https://rpc.ankr.com/http/scrt_cosmos',
    'https://1rpc.io/scrt-lcd',
    'https://lcd-secret.whispernode.com',
    'https://secret-api.lavenderfive.com',
  ])
  /** Connect to the Secret Network Mainnet. */
  export function mainnet (options: Partial<Chain> = {}): Promise<Chain> {
    return Chain.connect({
      chainId: chainIds.mainnet, urls: [...mainnets], ...options||{}
    })
  }
  export const testnets = new Set([
    'https://api.pulsar.scrttestnet.com',
    'https://api.pulsar3.scrttestnet.com/'
  ])
  /** Connect to the Secret Network Testnet. */
  export function testnet (options: Partial<Chain> = {}): Promise<Chain> {
    return Chain.connect({
      chainId: chainIds.testnet, urls: [...testnets], ...options||{}
    })
  }
  /** Connect to a mock implementation of Secret Network. */
  export async function mocknet (options: Partial<Chain> = {}): Promise<Chain> {
    const chain = await Chain.connect({ chainId: 'scrt-mocknet', })
    chain.connections = [new MocknetConnection({ chain })]
    return chain
  }
  export async function devnet (options): Promise<Chain> {
    let devnet
    try {
      devnet = await import('npm:@fadroma/devnet')
    } catch (e) {
      throw new Error('failed to import @fadroma/devnet. is it installed?')
    }
  }

  export namespace SNIP20 {
    export type Snip20Config = {
      /** The full name of the token. */
      name: string
      /** The market symbol of the token. */
      symbol: string
      /** The decimal precision of the token. */
      decimals: number
    }
    export type Snip20 = Snip20Config & {
      /** The address of the token contract. */
      address: Address
      /** THe code hash of the token contract. */
      codeHash?: CosmWasm.CodeHash
      /** The total supply of the token. */
      totalSupply: Uint128
    }
    export type Snip20Context = CosmWasm.ClientApi & {
      id:     string,
      chain?: Chain,
      agent?: { address?: Address },
      log:    Console,
    }
    export type Snip20InitMsg = Snip20Config & {
      /** The admin of the token. */
      admin: Address
      /** The PRNG seed for the token. */
      prng_seed: string
      /** The settings for the token. */
      config: {
        enable_mint?: boolean
        enable_burn?: boolean
        enable_redeem?: boolean
        enable_deposit?: boolean
        public_total_supply?: boolean
      }
      /** Initial balances. */
      initial_balances?: {address: Address, amount: Uint128}[]
    }
    export type Snip20Allowance = {
      spender: Address
      owner: Address
      allowance: Uint128
      expiration?: number|null
    }
    export type Snip20TokenInfo = {
      name: string
      symbol: string
      decimals: number
      total_supply?: Uint128|null
    }
    /** A viewing key. */
    export type ViewingKey = string
    /** A contract's viewing key methods. */
    export type ViewingKeyClient = {
      create (_: Snip20Context, entropy?: unknown): Promise<Uint8Array>
      set (_: Snip20Context, key: ViewingKey): Promise<void>
    }
    export interface Snip20Api {
      /** Get a comparable token ID. */
      readonly id: string
      /** Get a client to the Viewing Key API. */
      readonly vk: ViewingKeyClient
      /** @returns true */
      isFungible(): true
      /** @returns true */
      isCustom(): true
      /** @returns false */
      isNative(): false
      fetchMetadata(): Promise<this>
      fetchTokenInfo(): Promise<Snip20TokenInfo>
      fetchBalance(address: Address, key: string): Promise<Uint128>
      /** Change the admin of the token, who can set the minters */
      changeAdmin(address: string): Promise<unknown>
      /** Set specific addresses to be minters, remove all others */
      setMinters(minters: Array<string>): Promise<unknown>
      /** Add addresses to be minters */
      addMinters(minters: Array<string>): Promise<unknown>
      /** Mint SNIP20 tokens */
      mint(amount: Uint128, recipient: string|undefined): Promise<unknown>
      /** Burn SNIP20 tokens */
      burn(amount: Uint128, memo?: string): Promise<unknown>
      /** Deposit native tokens into the contract. */
      deposit(nativeToken: Tendermint.Coin[]): Promise<unknown>
      /** Redeem an amount of a native token from the contract. */
      redeem(amount: Uint128, denom?: string): Promise<unknown>
      /** Get the current allowance from `owner` to `spender` */
      fetchAllowance(owner: Address, spender: Address, key: string): Promise<Snip20Allowance>
      /** Check the current allowance from `owner` to `spender`. */
      checkAllowance(spender: string, owner: string, key: string): Promise<unknown>
      /** Increase allowance to spender */
      increaseAllowance (amount: string|number|bigint, spender: Address): Promise<unknown>
      /** Decrease allowance to spender */
      decreaseAllowance (amount: string|number|bigint, spender: Address): Promise<unknown>
      /** Transfer tokens to address */
      transfer (amount: Uint128, recipient: Address): Promise<unknown>
      transferFrom (owner: Address, recipient: Address, amount: Uint128, memo?: string): Promise<unknown>
      /** Send tokens to address.
        * Same as transfer but allows for receive callback. */
      send (amount: Uint128, recipient: Address, callback?: string|object): Promise<unknown>
      sendFrom (owner: Address, amount: Uint128, recipient: string,
                hash?: CosmWasm.CodeHash, msg?: string, memo?: string): Promise<unknown>
    }
    /** Create a SNIP20 init message. */
    export const initSnip20 = ({
      symbol, decimals, admin,
      name = symbol, config = {},
      balances = [], prngSeed = randomBase64()
    }: {
      symbol: string, decimals: number, admin: Address|{ address: Address },
      name?: string, config?: Partial<Snip20InitMsg["config"]>,
      balances?: Array<{address: Address, amount: Uint128}>, prngSeed?: string
    }): Snip20InitMsg => {
      if (admin && (typeof admin === 'object')) {
        admin = admin.address
      }
      return {
        name,
        symbol,
        decimals,
        admin: admin as Address,
        config,
        initial_balances: balances,
        prng_seed: prngSeed,
      }
    }
    const fetchMetadata = async (deps: Snip20Context) => {
      const info: { codeHash?: CosmWasm.CodeHash } = {}
      const { address, chain, codeHash } = deps
      if (!address) throw new Error("can't fetch metadata without contract address")
      if (!chain) throw new Error("can't fetch metadata without agent")
      const setCodeHash = ({codeHash}: {codeHash?: CosmWasm.CodeHash}) => info.codeHash = codeHash
      const setMetadata = ({name, symbol, decimals, total_supply}: Snip20TokenInfo) =>
          Object.assign(info, camelize({ name, symbol, decimals, total_supply }))
      return Promise.all([
        deps.fetchContractInfo(deps.address).then(setCodeHash),
        fetchTokenInfo(deps).then(setMetadata)
      ])
    }
    const fetchTokenInfo = async ({ querySelf }: Snip20Context) => {
      const msg = { token_info: {} }
      const { token_info }: { token_info: Snip20TokenInfo } = await querySelf(msg)
      return token_info
    }
    const fetchBalance = async ({ querySelf }: Snip20Context, address: Address, key: string) => {
      const msg = { balance: { address, key } }
      const response: { balance: { amount: Uint128 } } = await querySelf(msg)
      if (response.balance && response.balance.amount) {
        return response.balance.amount
      } else {
        throw new Error(JSON.stringify(response))
      }
    }
    const changeAdmin = ({ execSelf }: Snip20Context, address: string) =>
      execSelf({ change_admin: { address } })
    const setMinters = ({ execSelf }: Snip20Context, minters: Array<string>) =>
      execSelf({ set_minters: { minters } })
    const addMinters = ({ execSelf }: Snip20Context, minters: Array<string>) =>
      execSelf({ add_minters: { minters } })
    const mint = ({ execSelf, agent }: Snip20Context, amount: Uint128, recipient: string|undefined = agent?.address) => {
      if (!recipient) throw new Error('Snip20#mint: specify recipient')
      return execSelf({ mint: { amount: String(amount), recipient } })
    }
    const burn = ({ execSelf }: Snip20Context, amount: Uint128, memo?: string) =>
      execSelf({ burn: { amount: String(amount), memo } })
    const deposit = ({ execSelf }: Snip20Context, nativeToken: Tendermint.Coin[]) =>
      execSelf({ deposit: {} }, { send: nativeToken })
    const redeem = ({ execSelf }: Snip20Context, amount: Uint128, denom?: string) =>
      execSelf({ redeem: { amount: String(amount), denom } })
    const fetchAllowance = async (
      { querySelf }: Snip20Context, owner: Address, spender: Address, key: string
    ): Promise<Snip20Allowance> => {
      const response: { allowance: Snip20Allowance } = await querySelf({allowance: {owner, spender, key}})
      return response.allowance
    }
    const checkAllowance = ({ querySelf }: Snip20Context, spender: string, owner: string, key: string) =>
      querySelf({ check_allowance: { owner, spender, key } })
    const increaseAllowance = ({ execSelf, log, agent, id }: Snip20Context, spender: Address, amount: Uint128) => {
      const address = bold(agent?.address||'(missing address)')
      log.debug(
        `${address}: increasing allowance of`, bold(spender),
        'by', bold(String(amount)), bold(String(id))
      )
      return execSelf({ increase_allowance: { amount: String(amount), spender } })
    }
    const decreaseAllowance = ({ execSelf }: Snip20Context, amount: Uint128, spender: Address) =>
      execSelf({ decrease_allowance: { amount: String(amount), spender } })
    const transfer = ({ execSelf }: Snip20Context, amount: Uint128, recipient: Address) =>
      execSelf({ transfer: { amount, recipient } })
    const transferFrom = ({ execSelf }: Snip20Context, owner: Address, recipient: Address, amount: Uint128, memo?: string) =>
      execSelf({ transfer_from: { owner, recipient, amount, memo } })
    const send = (
      { execSelf }: Snip20Context, amount: Uint128, recipient: Address, callback?: string|object
    ) => execSelf({ send: {
      amount, recipient, msg: callback ? base64.encode(new TextEncoder().encode(JSON.stringify(callback))) : undefined
    } })
    const sendFrom = (
      { execSelf }: Snip20Context,
      owner: Address, amount: Uint128, recipient: String,
      hash?: CosmWasm.CodeHash, msg?: string, memo?: string
    ) => execSelf({ send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo } })
    const vk = (): ViewingKeyClient => ({
      /** Assign a user-specified viewing key. */
      set: ({ execSelf }: Snip20Context, key: ViewingKey) =>
        execSelf({ set_viewing_key: { key } }),
      /** Assign a random viewing key and return it to the user. */
      create: async ({ execSelf }: Snip20Context, entropy = randomBase64()) => {
        const msg = { create_viewing_key: { entropy, padding: null } }
        let { data } = await execSelf(msg) as { data: Uint8Array|Uint8Array[] }
        if (data instanceof Uint8Array) {
          return data
        } else {
          return data[0]
        }
      },
    })
    export const snip20Impl = {
      //get id () { return this.address! },
      //isFungible: () => true,
      //isCustom:   () => true,
      //isNative:   () => false,
      fetchMetadata,
      fetchTokenInfo,
      fetchBalance,
      changeAdmin,
      setMinters,
      addMinters,
      mint,
      burn,
      deposit,
      redeem,
      fetchAllowance,
      checkAllowance,
      increaseAllowance,
      decreaseAllowance,
      transfer,
      transferFrom,
      send,
      sendFrom,
      vk
    }
  }

  export namespace SNIP22 {
    export type Snip22Api = {
      batchTransfer (actions: Transfer[]): Promise<unknown>
      batchTransferFrom (actions: TransferFrom[]): Promise<unknown>
      batchSend (actions: Send[]): Promise<unknown>
      batchSendFrom (actions: SendFrom[]): Promise<unknown>
    }
    const batchTransfer = ({ execSelf }: CosmWasm.ClientApi, actions: Transfer[]) =>
      execSelf({ batch_transfer: { actions } })
    const batchTransferFrom = ({ execSelf }: CosmWasm.ClientApi, actions: TransferFrom[]) =>
      execSelf({ batch_transfer_from: { actions } })
    const batchSend = ({ execSelf }: CosmWasm.ClientApi, actions: Send[]) =>
      execSelf({ batch_transfer: { actions } })
    const batchSendFrom = ({ execSelf }: CosmWasm.ClientApi, actions: SendFrom[]) =>
      execSelf({ batch_send_from: { actions } })
    export const snip22Impl = {
      batchTransfer,
      batchTransferFrom,
      batchSend,
      batchSendFrom,
    }
    export interface Transfer {
      recipient: Address
      amount:    Uint128
      memo?:     string
    }
    export interface TransferFrom {
      owner:     Address
      recipient: Address
      amount:    Uint128
      memo?:     string
    }
    export interface Send {
      recipient:            Address
      recipient_code_hash?: CosmWasm.CodeHash
      amount:               Uint128
      msg?:                 string
      memo?:                string
    }
    export interface SendFrom {
      owner:                Address
      recipient_code_hash?: CosmWasm.CodeHash
      recipient:            Address
      amount:               Uint128
      msg?:                 string
      memo?:                string
    }
  }

  export namespace SNIP24 {
    export type Snip20Permit = Permit<'allowance'|'balance'|'history'|'owner'>
    export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }
    export const createPermitMsg = <Q> (query: Q, permit: Snip20Permit) =>
      ({ with_permit: { query, permit } })
    /** Data used for creating a signature as per the SNIP-24 spec:
      * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
      * This type is case sensitive! */
    export interface SignDoc {
      readonly chain_id: string;
      /** Always 0. */
      readonly account_number: string;
      /** Always 0. */
      readonly sequence: string;
      /** Always 0 uscrt + 1 gas */
      readonly fee: Tendermint.Fee;
      /** Always 1 message of type query_permit */
      readonly msgs: readonly AminoMsg[];
      /** Always empty. */
      readonly memo: string;
    }
    export interface Permit <T> {
      params: {
        permit_name: string,
        allowed_tokens: Address[]
        chain_id: string,
        permissions: T[]
      },
      signature: Signature
    }
    // This type is case sensitive!
    export interface Signature { readonly pub_key: Pubkey, readonly signature: string }
    export interface Pubkey { readonly type: 'tendermint/PubKeySecp256k1', readonly value: any }
    export interface AminoMsg { readonly type: string, readonly value: any }

    /** Used as the `value` field of the {@link AminoMsg} type. */
    export interface PermitAminoMsg<T> {
      permit_name:    string,
      allowed_tokens: Address[],
      permissions:    T[],
    }

    export abstract class PermitSigner {
      constructor (
        /** The id of the chain for which permits will be signed. */
        readonly chainId: Core.ChainId,
        /** The address which will do the signing and
          * which will be the address used by the contracts. */
        readonly address: Address,
      ) {}
      abstract sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
      static createSignDoc = <T> (chain_id: Core.ChainId, permit_msg: T): SignDoc => ({
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
      })
    }

    export class PermitSignerKeplr extends PermitSigner {
      constructor (
        chainId: Core.ChainId,
        address: Address,
        /** Must be a pre-configured instance. */
        readonly keplr: KeplrSigningHandle<any>
      ) { super(chainId, address) }
      async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {
        const preferNoSetFee  = true // Fee must be 0, so hide it from the user
        const preferNoSetMemo = true // Memo must be empty, so hide it from the user
        const { signature } = await this.keplr.signAmino( // Call Keplr signing UI
          this.chainId,
          this.address,
          PermitSignerKeplr.createSignDoc(this.chainId, permit_msg),
          { preferNoSetFee, preferNoSetMemo, }
        )
        return {
          params: {
            chain_id:       this.chainId,
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
        chain_id: Core.ChainId,
        address:  Address,
        signDoc:  SignDoc,
        options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
      ): Promise<Permit<T>>
    }

  }

  /** Client to an individual SNIP-721 non-fungible token contract. */
  export type Snip721 = CosmWasm.Contract & Tendermint.NonFungible;

  export const Faucets =  {
    'secret-4': new Set([ `https://faucet.secretsaturn.net/` ]),
    'pulsar-3': new Set([ `https://faucet.pulsar.scrttestnet.com/` ])
  } as Record<ChainId, Set<string>>;

}

import { optionallyParallel } from '../deps.ts'
import type { Address, Coin, Fee } from '../deps.ts'
import type { Context, AgentContext } from './scrt.ts'
import {
  ChainId,
  ChainRef,
  CodeHash,
  CodeId,
  Hash,
  Label,
  Message,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgStoreCode,
  SecretNetworkClient,
  bold
} from '../deps.ts'
import type { Console, Agent } from './scrt.ts'
import type { TxResponse, UploadedCode, Contract, } from '../deps.ts'
import faucets from './scrtFaucet.ts'
import { camelize, base64, randomBase64 } from '../deps.ts'
import type { Uint128 } from '../deps.ts'
import type { Chain } from './scrt.ts'
