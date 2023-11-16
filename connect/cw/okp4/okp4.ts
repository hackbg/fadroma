import { Error, Config, Connection, Batch } from '../cw-base'
import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Environment } from '@hackbg/conf'
import type { Uint128, Address, ChainId, CodeId } from '@fadroma/agent'
import { Contract, Token } from '@fadroma/agent'
import type { CosmWasmClient } from '@hackbg/cosmjs-esm'

/** Configuration for OKP4 */
class OKP4Config extends Config {
  static defaultTestnetChainId: string = 'okp4-nemeton-1'
  static defaultTestnetUrl: string = 'https://okp4-testnet-rpc.polkachu.com/'
  constructor (options: Partial<OKP4Config> = {}, environment?: Environment) {
    super(environment)
    this.override(options)
  }
  testnetChainId: string = this.getString('FADROMA_OKP4_TESTNET_CHAIN_ID',
    () => OKP4Config.defaultTestnetChainId)
  testnetUrl: string = this.getString('FADROMA_OKP4_TESTNET_URL',
    () => OKP4Config.defaultTestnetUrl)
}

export const testnets = new Set([
  'https://okp4-testnet-rpc.polkachu.com/',
  //'https://okp4-testnet-api.polkachu.com/'
])

import { CWMnemonicIdentity } from '../cw-identity'
class OKP4MnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties: { mnemonic: string }) {
    super({
      coinType: 118,
      bech32Prefix: 'okp4',
      hdAccountIndex: 0,
      ...properties
    })
  }
}

/** Connection for OKP4. */
class OKP4Connection extends Connection {
  /** Default denomination of gas token. */
  static gasToken = new Token.Native('uknow')
  /** Connect to OKP4 in testnet mode. */
  static testnet (options: Partial<OKP4Connection> = {}): OKP4Connection {
    const { testnetChainId: chainId, testnetUrl: chainUrl } = new OKP4Config()
    return super.testnet({ chainId, chainUrl, ...options||{}, }) as OKP4Connection
  }
  /** Connect to OKP4 in testnet mode. */
  static devnet (options: Partial<OKP4Connection> = {}): OKP4Connection {
    throw new Error('Devnet not installed. Import @hackbg/fadroma')
  }
  /** Transaction fees for this agent. */
  fees = {
    upload: OKP4Connection.gasToken.fee(10000000),
    init:   OKP4Connection.gasToken.fee(1000000),
    exec:   OKP4Connection.gasToken.fee(1000000),
    send:   OKP4Connection.gasToken.fee(1000000),
  }

  constructor (options: Partial<OKP4Connection> & { mnemonic?: string, config?: OKP4Config } = {
    config: new OKP4Config()
  }) {
    super({ coinType: 118, bech32Prefix: 'okp4', hdAccountIndex: 0, ...options } as Partial<Connection>)
  }

  /** Get clients for all Cognitarium instances, keyed by address. */
  //async cognitaria ({ map = true } = {}) {
    //const ids = Object.values(cognitariumCodeIds)
    //return await this.getContractsById(Cognitarium, ids, map)
  //}
  //[>* Get clients for all Objectarium instances, keyed by address. <]
  //async objectaria ({ map = true } = {}) {
    //const ids = Object.values(objectariumCodeIds)
    //return await this.getContractsById(Objectarium, ids, map)
  //}
  //[>* Get clients for all Law Stone instances, keyed by address. <]
  //async lawStones ({ map = true } = {}) {
    //const ids = Object.values(lawStoneCodeIds)
    //return await this.getContractsById(LawStone, ids, map)
  //}

  getContractsById (id: CodeId):
    Promise<Contract>
  getContractsById <C extends typeof Contract> (id: CodeId):
    Promise<InstanceType<C>>
  {
    return Promise.resolve(new Contract('', this) as InstanceType<C>)
  }

  getContractsByIds (ids: CodeId[]):
    Promise<Map<CodeId, Contract>>
  getContractsByIds (ids: Record<CodeId, typeof Contract>):
    Promise<Map<CodeId, Contract>>
  getContractsByIds (ids: unknown):
    Promise<Map<CodeId, Contract>>
  {
    return Promise.resolve(new Map())
  }

  //async getContractsById <C extends typeof Contract> (
    //Client: C = Contract as C,
    //ids: CodeId[],
    //map = true
  //): Promise<
    //typeof map extends true ? Map<Address, C> : Record<Address, C>
  //> {
    //const chainId = this.chainId
    //const contracts = map ? new Map() : {}
    //for (const id of ids) {
      //const codeId = Number(id)
      //if (isNaN(codeId)) throw new Error('non-number code ID encountered')
      //const api = await this.chainApi
      //const { checksum: codeHash } = await api.getCodeDetails(codeId)
      //const addresses = await api.getContracts(codeId)
      //for (const address of addresses) {
        //const contract = new Client(
          //{ address, codeHash, chainId, codeId: String(codeId) },
          //this
        //)
        //if (map) {
          //(contracts as Map<Address, C>).set(address, contract)
        //} else {
          //(contracts as Record<Address, C>)[address] = contract
        //}
      //}
    //}
    //return contracts
  //}
}

export {
  OKP4Config           as Config,
  OKP4MnemonicIdentity as MnemonicIdentity,
  OKP4Connection       as Connection
}

/** Connect to OKP4 testnet. */
export const testnet = (...args: Parameters<typeof OKP4Connection.testnet>) => OKP4Connection.testnet(...args)

/** Connect to local OKP4 devnet. */
export const devnet = (...args: Parameters<typeof OKP4Connection.devnet>) => OKP4Connection.devnet(...args)

export * from './okp4-cognitarium'
export * from './okp4-objectarium'
export * from './okp4-law-stone'
