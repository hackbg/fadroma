import { CLI, CWError as Error } from '../CWBase'
import { CWChain, CWConnection } from '../CWConnection'
import { CWMnemonicIdentity } from '../CWIdentity'

import { Objectarium, objectariumCodeIds } from './okp4-objectarium'
import { Cognitarium, cognitariumCodeIds } from './okp4-cognitarium'
import { LawStone, lawStoneCodeIds } from './okp4-law-stone'

import type { Uint128, Address, ChainId, CodeId } from '@hackbg/fadroma'
import { pickRandom, Chain, Token } from '@hackbg/fadroma'

export * from './okp4-cognitarium'
export * from './okp4-objectarium'
export * from './okp4-law-stone'

class OKP4CLI extends CLI {}

export default class OKP4Chain extends CWChain {

  /** Connect to OKP4 in testnet mode. */
  static testnet (options: Partial<OKP4Connection> = {}): Promise<OKP4Chain> {
    return OKP4Chain.connect({
      chainId: chainIds.testnet,
      urls: [...testnets], ...options||{}
    })
  }

  declare connections: OKP4Connection[]

}

/** Connection for OKP4. */
class OKP4Connection extends CWConnection {

  /** Default denomination of gas token. */
  static gasToken = new Token.Native('uknow')

  constructor (properties: ConstructorParameters<typeof CWConnection>[0]) {
    super({
      ...defaults,
      //fees: {
        //upload: OKP4Connection.gasToken.fee(10000000),
        //init:   OKP4Connection.gasToken.fee(1000000),
        //exec:   OKP4Connection.gasToken.fee(1000000),
        //send:   OKP4Connection.gasToken.fee(1000000),
      //},
      ...properties
    })
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

class OKP4MnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({
      ...defaults,
      ...properties||{}
    })
  }
}

const defaults = {
  coinType: 118,
  bech32Prefix: 'okp4',
  hdAccountIndex: 0,
}

export {
  OKP4CLI              as CLI,
  OKP4Connection       as Connection,
  OKP4MnemonicIdentity as MnemonicIdentity,
}

export const chainIds = { testnet: 'okp4-nemeton-1', }

export const testnets = new Set([ 'https://okp4-testnet-rpc.polkachu.com/' ])
