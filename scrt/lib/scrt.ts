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
  Address,
  Bip39,
  Bip39EN,
  base16,
  base64,
  ChainId
} from '../deps.ts'
import * as Bank from './scrtBank.ts'
import * as Batch from './scrtBatch.ts'
import * as Compute from './scrtCompute.ts'
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
export type Identity = {
  getApi ({chainId, url}: {chainId: Core.ChainId, url: string|URL}): SecretNetworkClient
  wallet?: Wallet,
  address?: Address,
  encryptionUtils?: EncryptionUtils
}
export type Agent = Core.Agent & {
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
export const gasToken = new Tendermint.nativeToken('uscrt')

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
    const chain = Tendermint.chain({ id, urls })
    const connections = urls.map(url=>new Connection({ chain, url: url.toString() }))
    chain.connections = connections
    return chain
  },
  authenticate: (...args: unknown[]): Promise<Agent> => {
    if (args.length === 0) {
      return new Agent({ chain: api, api: new SecretNetworkClient({ chainId: chain.id, url: chain.getConnection().url }) })
    } else {
      throw new Error("unimplemented!")
    }
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
  fetchBlock: async (parameter?): Promise<Block> => {
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
  setMaxGas: async (deps: AgentDeps, gas?: unknown) => {
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
