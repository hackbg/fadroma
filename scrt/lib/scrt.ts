/**
  Fadroma SCRT
  Copyright (C) 2023 Hack.bg

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
import {
  Core,
  Tendermint,
  CosmWasm,
  SecretNetworkClient,
  Wallet,
  EncryptionUtils,
  MsgStoreCode,
  MsgInstantiateContract,
  MsgExecuteContract,
  Address,
  Bip39,
  Bip39EN,
  bold,
  base16,
  base64
} from '../deps.ts'
import * as Bank from './scrtBank.ts'
import * as Compute from './scrtCompute.ts'
import * as Pos from './scrtPos.ts'
import * as Gov from './scrtGov.ts'
import faucets from './scrtFaucet.ts'
export class Error extends Tendermint.Error {}
export class Console extends Tendermint.Console {
  override label = '@fadroma/scrt'
}
export const console = new Console()
/** Represents a Secret Network API endpoint. */
export type Connection = Tendermint.Connection & {
  /** Underlying API client. */
  api: SecretNetworkClient
}
export type Chain = Tendermint.Chain & {
  connect (options: { id?: string, urls?: (string|URL)[] }): Chain,
  getConnection: () => Connection,
  authenticate:  (...args: unknown[]) => Promise<Agent>,
  fetchLimits:   () => Promise<{ gas: number }>,
  connections:   Connection[],
}
/** Represents the dependencies of the API methods. */
export type Deps = Tendermint.Deps & {
  withIntoError <T>(p: Promise<T>): Promise<T>
  api: SecretNetworkClient,
}
export type AgentDeps = Deps & {
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
export type Block = Tendermint.Block
export type Batch = Tendermint.Batch & {
  /** Messages to encrypt. */
  messages: Array<
    |InstanceType<typeof MsgStoreCode>
    |InstanceType<typeof MsgInstantiateContract>
    |InstanceType<typeof MsgExecuteContract>
  >
}
export type BatchResult = {
  sender?:   Address
  tx:        Core.Hash
  type:      'wasm/MsgInstantiateContract'|'wasm/MsgExecuteContract'
  chainId:   Core.ChainId
  codeId?:   CosmWasm.CodeId
  codeHash?: CosmWasm.CodeHash
  address?:  Address
  label?:    CosmWasm.ContractLabel
}
export type Identity = Core.Identity & {
  getApi ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient
}
export type SignerIdentity = Identity & { encryptionUtils?: EncryptionUtils }
export type MnemonicIdentity = Identity & { wallet?: Wallet }
export type Agent = Tendermint.Agent & {
  chain:    Chain,
  identity: Identity,
  /** Set permissive fees by default. */
  fees: { upload: Tendermint.Fee, init: Tendermint.Fee, exec: Tendermint.Fee, send: Tendermint.Fee },
  setMaxGas: () => Promise<this>,
  account: ReturnType<SecretNetworkClient['query']['auth']['account']>,
  getNonce: () => Promise<{ accountNumber: number, sequence: number }>,
  encrypt: (codeHash: CosmWasm.CodeHash, msg: CosmWasm.Message) => any,
}
/** Smallest unit of native token. */
export const gasToken = new Token.Native('uscrt')

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
  connect: async ({ chainId, urls = [] }: { chainId: Core.ChainId, urls: (string|URL)[] }): Promise<Chain> => {
    const chain = new Chain({ chainId })
    const connections = urls.map(url=>new Connection({
      chain,
      url: url.toString()
    }))
    chain.connections = connections
    return chain
  },
  authenticate: async (...args: unknown[]): Promise<Agent> => {
    if (args.length === 0) {
      const chain = api
      const api   = new SecretNetworkClient({ chainId: chain.id, url: chain.getConnection().url })
      return new Agent({ chain, api, null })
    } else {
      throw new Error("unimplemented!")
    }
  },
  fetchLimits: async (): Promise<{ gas: number }> => {
    const params = { subspace: "baseapp", key: "BlockParams" }
    const { param } = await api.api.query.params.params(params)
    let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
    api.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
    if (max_gas < 0) {
      max_gas = 10000000
      api.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
    }
    return { gas: max_gas }
  },
})
export const connectionMethods = (api: any) => ({
  constructor: (properties?: Partial<Connection>) => {
    super(properties as Partial<Connection>)
    api.api ??= new SecretNetworkClient({ url: api.url!, chainId: api.chainId!, })
    const {chainId, url} = api
    if (!chainId) {
      throw new Error("can't authenticate without chainId")
    }
    if (!url) {
      throw new Error("can't connect without url")
    }
    api.api = new SecretNetworkClient({ chainId, url })
  },
  fetchBlockImpl: async (parameter?): Promise<Block> => {
    if (!parameter) {
      let {
        block_id: { hash, part_set_header } = {},
        block: { header, data, evidence, last_commit } = {}
      } = await api.api.query.tendermint.getLatestBlock({})
      if (hash instanceof Uint8Array) {
        hash = base16.encode(hash) as any
      }
      return new Block({
        hash:   hash as any,
        height: Number(header?.height)
      })
    }
  },
  fetchHeight: async () => (await api.fetchBlockImpl()).height,
  fetchBalance: (...args: Parameters<Connection["fetchBalanceImpl"]>) =>
    Bank.fetchBalance(api, ...args),
  fetchCodeInfo: (...args: Parameters<Connection["fetchCodeInfoImpl"]>) =>
    Compute.fetchCodeInfo(api, ...args),
  fetchCodeInstances: (...args: Parameters<Connection["fetchCodeInstancesImpl"]>) =>
    Compute.fetchCodeInstances(api, ...args),
  fetchContractInfo: (...args: Parameters<Connection["fetchContractInfoImpl"]>) =>
    Compute.fetchContractInfo(api, ...args),
  query: <T> (parameters: Parameters<Connection["queryImpl"]>[0]): Promise<T> =>
    Compute.query(api, parameters) as Promise<T>,
})
export const fromKeplr = () => { throw new Error('unimplemented') }
export const fromMnemonic = (
  mnemonic = Bip39.generateMnemonic(Bip39EN),
  wallet   = new Wallet(mnemonic),
): MnemonicIdentity => {
  return {
    address: wallet.address,
    wallet,
    getApi: ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient =>
      new SecretNetworkClient({
        chainId,
        url: url.toString(),
        wallet,
        walletAddress: wallet.address,
      })
  }
}
export const fromSigner = (encryptionUtils: EncryptionUtils): SignerIdentity => {
  return {
    encryptionUtils,
    getApi: ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient =>
      new SecretNetworkClient({
        chainId,
        url: url.toString(),
        encryptionUtils,
      })
  }
}
export const agent = (config: { log: Console, identity: Identity|EncryptionUtils|string }) => {
  if (!(config.identity instanceof Identity)) {
    if (!(typeof config.identity === 'object')) {
      throw new Error('identity must be Identity instance, { mnemonic }, or { encryptionUtils }')
    } else if ((config.identity as { mnemonic?: string }).mnemonic) {
      config.log.debug('Identifying with mnemonic')
      config.identity = fromMnemonic(config.identity)
    } else if ((config.identity as { encryptionUtils?: unknown }).encryptionUtils) {
      config.log.debug('Identifying with signer (encryptionUtils)')
      config.identity = fromSigner(config.identity.encryptionUtils)
    } else {
      throw new Error('identity must be Identity instance, { mnemonic }, or { encryptionUtils }')
    }
  }
  config.#connection = new SigningConnection({ chain: config.chain, identity: config.identity })
}
export const batch = (agent: Agent): Batch => ({ agent })
export const agentMethods = x => ({
  batch: (agent: Agent): Batch => batch(agent),
  fees: {
    upload: gasToken.fee(10000000),
    init:   gasToken.fee(10000000),
    exec:   gasToken.fee(1000000),
    send:   gasToken.fee(1000000),
  },
  async setMaxGas (): Promise<this> {
    const { gas } = await this.chain.fetchLimits()
    const max = gasToken.fee(gas)
    this.fees = { upload: max, init: max, exec: max, send: max }
    return this
  },
  get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
    return this.getConnection().api.query.auth.account({ address: this.address })
  },
  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const result: any = await this.account ?? (() => {
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    })()
    const { account_number, sequence } = result.account
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  },
  async encrypt (codeHash: CosmWasm.CodeHash, msg: CosmWasm.Message) {
    if (!codeHash) {
      throw new Error("can't encrypt message without code hash")
    }
    const { encryptionUtils } = this.getConnection().api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  },
})
export class SigningConnection extends SigningConnection {
  constructor (
    properties: Omit<ConstructorParameters<typeof SigningConnection>[0], 'identity'>
      & { identity: Identity, url: string|URL }
  ) {
    super(properties)
    this.api = this.identity.getApi({
      chainId: this.chain.chainId,
      url:     properties.url
    })
  }
  api: SecretNetworkClient
  get identity (): Identity {
    return super.identity as unknown as Identity
  }
  async send (...args: Parameters<SigningConnection["sendImpl"]>) {
    return await Bank.send(this, ...args)
  }
  async upload (...args: Parameters<SigningConnection["uploadImpl"]>) {
    return await Compute.upload(this, ...args)
  }
  async instantiate (...args: Parameters<SigningConnection["instantiateImpl"]>) {
    return await Compute.instantiate(this, ...args)
  }
  async execute <T> (...args: Parameters<SigningConnection["executeImpl"]>): Promise<T> {
    return await Compute.execute(this, ...args) as T
  }
}
/** TODO: Upload in batch. */
export const uploadInBatch = (
  { agent, messages }: Batch,
  code:    Parameters<Batch["upload"]>[0],
  options: Parameters<Batch["upload"]>[1]
) => {
  throw new Error('Batch#upload: not implemented')
  return this
}
export const instantiateInBatch = (
  { agent, messages }: Batch,
  code:    Parameters<Batch["instantiate"]>[0],
  options: Parameters<Batch["instantiate"]>[1],
) => {
  messages.push(new MsgInstantiateContract({
    //callback_code_hash: '',
    //callback_sig:       null,
    sender:     agent!.address!,
    code_id:    ((typeof code === 'object') ? code.codeId : code) as CodeId,
    label:      options.label!,
    init_msg:   options.initMsg,
    init_funds: options.initSend,
  }))
  return this
}
export const executeInBatch = (
  { agent, messages }: Batch,
  contract: Parameters<Batch["execute"]>[0],
  message:  Parameters<Batch["execute"]>[1],
  options:  Parameters<Batch["execute"]>[2],
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
export const encryptUpload = async (upload: any): Promise<any> =>
  { throw new Error('not implemented') }
export const encryptInit = async (agent: Agent, init: {
  codeId:   CosmWasm.CodeId,
  codeHash: CosmWasm.CodeHash,
  label:    CosmWasm.ContractLabel
  msg:      CosmWasm.Message,
  funds:    Tendermint.Coin[],
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
  codeHash: CosmWasm.CodeHash,
  msg:      CosmWasm.Message,
  funds:    Tendermint.Coin[]
}) => ({
  "@type":      '/secret.compute.v1beta1.MsgExecuteContract',
  sender:       agent.address,
  contract:     exec.contract,
  sent_funds:   exec.funds,
  msg:          await agent.encrypt(exec.codeHash, exec.msg),
  callback_sig: null,
  callback_code_hash: '',
})
/** Format the messages for API v1 like secretjs and encrypt them. */
const encryptBatch = ({ agent, log, messages = [] }): Promise<any[]> =>
  Promise.all(messages.map((message: object) => {
    switch (true) {
      case (message instanceof MsgStoreCode):           return encryptUpload(message)
      case (message instanceof MsgInstantiateContract): return encryptInit(agent, message as any)
      case (message instanceof MsgExecuteContract):     return encryptExec(agent, message as any)
      default: throw new Error(`unsupported batch message: ${message}`)
    }
  }))
const simulateBatch = (batch: Batch, ) => {
  Promise.resolve(batch.chain!.api).then(api=>api.tx.simulate(batch.messages))
const submitBatch = async (batch: Batch, { memo = "" }: { memo: string }): Promise<BatchResult[]> => {
  const api = await Promise.resolve(batch.chain!.api)
  const chainId  = batch.chain!.chainId!
  const messages = batch.messages
  const limit    = Number(batch.agent!.fees?.exec?.amount[0].amount) || undefined
  const gas      = messages.length * (limit || 0)
  const results: BatchResult[] = []
  try {
    const txResult = await api.tx.broadcast(messages as any, { gasLimit: gas })
    if (txResult.code !== 0) {
      const error = `(in batch): gRPC error ${txResult.code}: ${txResult.rawLog}`
      throw Object.assign(new Error(error), txResult)
    }
    for (const i in messages) {
      const msg    = messages[i]
      const sender = batch.agent!.address
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
    batch.log.br()
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
const saveBatch = async (batch: Batch, name?: string) => {
  // Number of batch, just for identification in console
  name ??= name || `TX.${+new Date()}`
  // Get signer's account number and sequence via the canonical API
  const { accountNumber, sequence } = await batch.agent!.getNonce()//batch.chain.url, batch.chain!.address)
  // Print the body of the batch
  batch.log.debug(`Messages in batch:`)
  for (const msg of batch.messages??[]) {
    batch.log.debug(' ', JSON.stringify(msg))
  }
  // The base Batch class stores messages as (immediately resolved) promises
  const messages = await batch.encryptedMessages
  // Print the body of the batch
  batch.log.debug(`Encrypted messages in batch:`)
  for (const msg of messages??[]) {
    batch.log.info(' ', JSON.stringify(msg))
  }
  // Compose the plaintext
  const unsigned = batch.composeUnsignedTx(messages as any, name)
  // Output signing instructions to the console
  
  const output = `${name}.signed.json`
  const string = JSON.stringify(unsigned)
  const txdata = shellescape([string])
  batch.log.br()
  batch.log.info('Multisig batch ready.')
  batch.log.info(`Run the following command to sign the batch:
\nsecretcli tx sign /dev/stdin --output-document=${output} \\
--offline --from=YOUR_MULTISIG_MEMBER_ACCOUNT_NAME_HERE --multisig=${batch.agent!.address} \\
--chain-id=${batch.chain!.chainId} --account-number=${accountNumber} --sequence=${sequence} \\
<<< ${txdata}`)
  batch.log.br()
  batch.log.debug(`Batch contents:`, JSON.stringify(unsigned, null, 2))
  batch.log.br()

  return {
    name,
    accountNumber,
    sequence,
    unsignedTxBody: JSON.stringify(unsigned)
  }
}
const composeUnsignedTx = (encryptedMessages: any[], memo?: string): any => {
  const fee = Connection.gas(10000000).asFee()
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
