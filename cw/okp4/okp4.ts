import { CWError as Error } from '../cw-base'
import { CWConnection, CWBatch } from '../cw-connection'
import CWIdentity, { CWMnemonicIdentity } from '../cw-identity'

import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Uint128, Address, ChainId, CodeId } from '@fadroma/agent'
import { Core, Chain, Token } from '@fadroma/agent'
import type { CosmWasmClient } from '@hackbg/cosmjs-esm'

export * from './okp4-cognitarium'
export * from './okp4-objectarium'
export * from './okp4-law-stone'

export const chainIds = { testnet: 'okp4-nemeton-1', }

export const testnets = new Set([ 'https://okp4-testnet-rpc.polkachu.com/' ])

/** Connect to OKP4 in testnet mode. */
export const testnet = (options: Partial<OKP4Connection> = {}): OKP4Connection => {
  return new OKP4Connection({
    chainId: chainIds.testnet, url: Core.pickRandom(testnets), ...options||{}
  })
}

const defaults = { coinType: 118, bech32Prefix: 'okp4', hdAccountIndex: 0, }

export class OKP4MnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
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

  constructor (options: Partial<OKP4Connection>) {
    super({ ...defaults, ...options } as Partial<CWConnection>)
  }

  getContractsById (id: CodeId):
    Promise<Chain.Contract>
  getContractsById <C extends typeof Chain.Contract> (id: CodeId):
    Promise<InstanceType<C>>
  {
    return Promise.resolve(new Chain.Contract({
      instance: { address: '' },
      connection: this
    }) as InstanceType<C>)
  }

  getContractsByIds (ids: CodeId[]):
    Promise<Map<CodeId, Chain.Contract>>
  getContractsByIds (ids: Record<CodeId, typeof Chain.Contract>):
    Promise<Map<CodeId, Chain.Contract>>
  getContractsByIds (ids: unknown):
    Promise<Map<CodeId, Chain.Contract>>
  {
    return Promise.resolve(new Map())
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
