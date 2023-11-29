import { Error, Config } from '../cw-base'
import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'

import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Environment } from '@hackbg/conf'
import type { Uint128, Address, ChainId, CodeId } from '@fadroma/agent'
import { Contract, Token } from '@fadroma/agent'
import type { CosmWasmClient } from '@hackbg/cosmjs-esm'

export class OKP4MnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic: string }) {
    super({
      coinType: 118,
      bech32Prefix: 'okp4',
      hdAccountIndex: 0,
      ...properties||{}
    })
  }
}

/** Connection for OKP4. */
export class OKP4Connection extends CWConnection {
  /** Default denomination of gas token. */
  static gasToken = new Token.Native('uknow')
  /** Transaction fees for this agent. */
  fees = {
    upload: OKP4Connection.gasToken.fee(10000000),
    init:   OKP4Connection.gasToken.fee(1000000),
    exec:   OKP4Connection.gasToken.fee(1000000),
    send:   OKP4Connection.gasToken.fee(1000000),
  }

  constructor (options: Partial<OKP4Connection> & { mnemonic?: string }) {
    super({
      coinType: 118,
      bech32Prefix: 'okp4',
      hdAccountIndex: 0,
      ...options
    } as Partial<CWConnection>)
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
    return Promise.resolve(new Contract({
      instance: { address: '' },
      connection: this
    }) as InstanceType<C>)
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

export * from './okp4-cognitarium'
export * from './okp4-objectarium'
export * from './okp4-law-stone'

export default class FadromaOKP4 {
  static Connection = OKP4Connection
  static Identity = { ...CWIdentity, Mnemonic: OKP4MnemonicIdentity }
  static Batch = CWBatch
  /** Connect to OKP4 in testnet mode. */
  static testnet = (options: Partial<OKP4Connection> = {}): OKP4Connection => {
    return new OKP4Connection({
      chainId: 'okp4-nemeton-1',
      url:     'https://okp4-testnet-rpc.polkachu.com/',
      //'https://okp4-testnet-api.polkachu.com/'
      ...options||{}
    })
  }
}
