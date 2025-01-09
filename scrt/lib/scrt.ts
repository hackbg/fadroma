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

import { Error, Console } from '@hackbg/fadroma'
import { base16, base64, Connection, Token, Chain, Identity, Agent, SigningConnection } from '@hackbg/fadroma'
import type { ChainId } from '@hackbg/fadroma'
import type { ChainId, CodeHash, Message } from '@hackbg/fadroma'
import { SecretNetworkClient, Wallet } from 'npm:@hackbg/secretjs-esm'
import type { EncryptionUtils } from 'npm:@hackbg/secretjs-esm'
import { SecretNetworkClient } from 'npm:@hackbg/secretjs-esm'
import { ScrtBlock } from './scrtTx.ts'
import * as ScrtBank from './scrtBank.ts'
import * as ScrtCompute from './scrtCompute.ts'
import * as ScrtStaking from './scrtPos.ts'
import * as ScrtGovernance from './scrtGov.ts'
import faucets from './scrtFaucet.ts'
import { ScrtBatch } from './scrtTx.ts'
export class ScrtError extends Error {}
export class ScrtConsole extends Console { label = '@fadroma/scrt' }
export const console = new ScrtConsole()
export {
  Bip32, Bip39, Bip39EN,
  Ed25519, SHA256, Secp256k1,
  assign,
  base16, base64, bech32,
  bold,
  brailleDump,
  colors,
  into,
  randomBase64,
  randomBech32,
} from '@hackbg/fadroma'
export * as SecretJS from 'npm:@hackbg/secretjs-esm'
export { ScrtBatch as Batch, } from './scrtTx.ts'
export { default as faucets } from './scrtFaucet.ts'
//export * as Mocknet from './mocknet/scrt-mocknet'
export * as Snip20 from './snip20.ts'
export * as Snip24 from './snip24.ts'
export * as Snip721 from './snip721.ts'
export const chainIds = {
  mainnet: 'secret-4',
  testnet: 'pulsar-3',
}
export function connect (...args: Parameters<typeof ScrtChain["connect"]>) {
  if (!args[0]) args[0] = {} as any
  return ScrtChain.connect(...args)
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
export function mainnet (options: Partial<ScrtChain> = {}): Promise<ScrtChain> {
  return ScrtChain.connect({
    chainId: chainIds.mainnet, urls: [...mainnets], ...options||{}
  })
}
export const testnets = new Set([
  'https://api.pulsar.scrttestnet.com',
  'https://api.pulsar3.scrttestnet.com/'
])
/** Connect to the Secret Network Testnet. */
export function testnet (options: Partial<ScrtChain> = {}): Promise<ScrtChain> {
  return ScrtChain.connect({
    chainId: chainIds.testnet, urls: [...testnets], ...options||{}
  })
}
const pickRandom = <T>(set: Set<T>): T => [...set][Math.floor(Math.random()*set.size)]
/** Connect to a mock implementation of Secret Network. */
export async function mocknet (options: Partial<ScrtChain> = {}): Promise<ScrtChain> {
  const chain = await ScrtChain.connect({ chainId: 'scrt-mocknet', })
  chain.connections = [new ScrtMocknetConnection({ chain })]
  return chain
}
export async function devnet (options): Promise<ScrtChain> {
  let devnet
  try {
    devnet = await import('npm:@fadroma/devnet')
  } catch (e) {
    throw new Error('Failed to import @fadroma/devnet. Is it installed?')
  }
}
export const withIntoError = <T>(p: Promise<T>): Promise<T> =>
  p.catch(intoError)
const intoError = async (e: object)=>{
  e = await Promise.resolve(e)
  console.error(e)
  throw Object.assign(new Error(), e)
}
export class ScrtChain extends Chain {
  declare connections: ScrtConnection[]
  getConnection (): ScrtConnection {
    const [connection] = this.connections || []
    if (!connection) {
      throw new Error('No available connections.')
    }
    return connection
  }
  static async connect ({ chainId, urls = [] }: {
    chainId: ChainId,
    urls:    (string|URL)[]
  }): Promise<ScrtChain> {
    const chain = new ScrtChain({ chainId })
    const connections = urls.map(url=>new ScrtConnection({
      chain,
      url: url.toString()
    }))
    chain.connections = connections
    return chain
  }
  async authenticate (...args: unknown[]): Promise<ScrtAgent> {
    if (args.length === 0) {
      return new ScrtAgent({
        chain:    this,
        api:      new SecretNetworkClient({
          chainId: this.chainId,
          url:     this.getConnection().url
        }),
        identity: null,
      })
    } else {
      throw new Error("unimplemented!")
    }
  }
  async fetchLimits (): Promise<{ gas: number }> {
    const params = { subspace: "baseapp", key: "BlockParams" }
    const { param } = await this.api.query.params.params(params)
    let { max_bytes, max_gas } = JSON.parse(param?.value??'{}')
    this.log.debug(`Fetched default gas limit: ${max_gas} and code size limit: ${max_bytes}`)
    if (max_gas < 0) {
      max_gas = 10000000
      this.log.warn(`Chain returned negative max gas limit. Defaulting to: ${max_gas}`)
    }
    return { gas: max_gas }
  }
}
/** Represents a Secret Network API endpoint. */
export class ScrtConnection extends Connection {

  /** Underlying API client. */
  declare api: SecretNetworkClient

  /** Smallest unit of native token. */
  static gasToken = new Token.Native('uscrt')

  constructor (properties?: Partial<ScrtConnection>) {
    super(properties as Partial<Connection>)
    this.api ??= new SecretNetworkClient({ url: this.url!, chainId: this.chainId!, })
    const {chainId, url} = this
    if (!chainId) {
      throw new Error("can't authenticate without chainId")
    }
    if (!url) {
      throw new Error("can't connect without url")
    }
    this.api = new SecretNetworkClient({ chainId, url })
  }

  override async fetchBlockImpl (parameter?): Promise<ScrtBlock> {
    if (!parameter) {
      let {
        block_id: { hash, part_set_header } = {},
        block: { header, data, evidence, last_commit } = {}
      } = await this.api.query.tendermint.getLatestBlock({})
      if (hash instanceof Uint8Array) {
        hash = base16.encode(hash) as any
      }
      return new ScrtBlock({
        hash:   hash as any,
        height: Number(header?.height)
      })
    }
  }

  override async fetchHeightImpl () {
    const { height } = await this.fetchBlockImpl()
    return height
  }

  override async fetchBalanceImpl (
    ...args: Parameters<Connection["fetchBalanceImpl"]>
  ) {
    return await ScrtBank.fetchBalance(this, ...args)
  }

  override async fetchCodeInfoImpl (
    ...args: Parameters<Connection["fetchCodeInfoImpl"]>
  ) {
    return await ScrtCompute.fetchCodeInfo(this, ...args)
  }

  override async fetchCodeInstancesImpl (
    ...args: Parameters<Connection["fetchCodeInstancesImpl"]>
  ) {
    return await ScrtCompute.fetchCodeInstances(this, ...args)
  }

  override async fetchContractInfoImpl (
    ...args: Parameters<Connection["fetchContractInfoImpl"]>
  ) {
    return await ScrtCompute.fetchContractInfo(this, ...args)
  }

  override async queryImpl <T> (parameters: Parameters<Connection["queryImpl"]>[0]): Promise<T> {
    return await ScrtCompute.query(this, parameters) as T
  }
}
export class ScrtAgent extends Agent {
  constructor (properties: ConstructorParameters<typeof Agent>[0]) {
    super(properties)
    if (!(this.identity instanceof ScrtIdentity)) {
      if (!(typeof this.identity === 'object')) {
        throw new Error('identity must be ScrtIdentity instance, { mnemonic }, or { encryptionUtils }')
      } else if ((this.identity as { mnemonic?: string }).mnemonic) {
        this.log.debug('Identifying with mnemonic')
        this.identity = new ScrtMnemonicIdentity(this.identity)
      } else if ((this.identity as { encryptionUtils?: unknown }).encryptionUtils) {
        this.log.debug('Identifying with signer (encryptionUtils)')
        this.identity = new ScrtSignerIdentity(this.identity)
      } else {
        throw new Error('identity must be ScrtIdentity instance, { mnemonic }, or { encryptionUtils }')
      }
    }
    this.#connection = new ScrtSigningConnection({ chain: this.chain, identity: this.identity })
  }

  declare chain:    ScrtChain
  declare identity: ScrtIdentity
  #connection: ScrtSigningConnection
  override getConnection () {
    return this.#connection
  }
  override batch (): ScrtBatch {
    return new ScrtBatch({ agent: this })
  }

  /** Set permissive fees by default. */
  fees = {
    upload: ScrtConnection.gasToken.fee(10000000),
    init:   ScrtConnection.gasToken.fee(10000000),
    exec:   ScrtConnection.gasToken.fee(1000000),
    send:   ScrtConnection.gasToken.fee(1000000),
  }

  async setMaxGas (): Promise<this> {
    const { gas } = await this.chain.fetchLimits()
    const max = ScrtConnection.gasToken.fee(gas)
    this.fees = { upload: max, init: max, exec: max, send: max }
    return this
  }

  get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
    return this.getConnection().api.query.auth.account({ address: this.address })
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const result: any = await this.account ?? (() => {
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    })()
    const { account_number, sequence } = result.account
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) {
      throw new Error("can't encrypt message without code hash")
    }
    const { encryptionUtils } = this.getConnection().api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }
}
export class ScrtSigningConnection extends SigningConnection {
  constructor (
    properties: Omit<ConstructorParameters<typeof SigningConnection>[0], 'identity'>
      & { identity: ScrtIdentity, url: string|URL }
  ) {
    super(properties)
    this.api = this.identity.getApi({
      chainId: this.chain.chainId,
      url:     properties.url
    })
  }
  api: SecretNetworkClient
  get identity (): ScrtIdentity {
    return super.identity as unknown as ScrtIdentity
  }
  async sendImpl (...args: Parameters<SigningConnection["sendImpl"]>) {
    return await ScrtBank.send(this, ...args)
  }
  async uploadImpl (...args: Parameters<SigningConnection["uploadImpl"]>) {
    return await ScrtCompute.upload(this, ...args)
  }
  async instantiateImpl (...args: Parameters<SigningConnection["instantiateImpl"]>) {
    return await ScrtCompute.instantiate(this, ...args)
  }
  async executeImpl <T> (...args: Parameters<SigningConnection["executeImpl"]>): Promise<T> {
    return await ScrtCompute.execute(this, ...args) as T
  }
}
export abstract class ScrtIdentity extends Identity {
  abstract getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient

  static fromKeplr = () => {
    throw new Error('unimplemented')
  }
}
export class ScrtSignerIdentity extends ScrtIdentity {
  encryptionUtils?: EncryptionUtils
  constructor ({ encryptionUtils, ...properties }: Partial<ScrtSignerIdentity>) {
    super(properties)
  }
  getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient {
    return new SecretNetworkClient({
      chainId,
      url: url.toString(),
      encryptionUtils: this.encryptionUtils
    })
  }
}
export class ScrtMnemonicIdentity extends ScrtIdentity {
  wallet: Wallet
  constructor ({
    mnemonic = Bip39.generateMnemonic(Bip39EN),
    wallet = new Wallet(mnemonic),
    ...properties
  }: Partial<ScrtMnemonicIdentity & {
    mnemonic: string
  }>) {
    super(properties)
    this.wallet = wallet
    if (this.address && (wallet.address !== this.address)) {
      throw new Error(`computed address ${wallet.address} did not match ${this.address}`)
    }
    this.address = wallet.address
  }
  getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient {
    const {wallet} = this
    return new SecretNetworkClient({
      chainId,
      url: url.toString(),
      wallet,
      walletAddress: wallet.address,
    })
  }
}
