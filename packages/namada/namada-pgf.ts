//import { Core } from '@fadroma/agent'
//import * as Borsher from 'borsher'
//import type { Address } from './namada-address'
//import { addr } from './namada-address'
//import { Struct, set, u256, i256, map } from '@hackbg/borshest'

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

export async function getPGFParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return PGFParameters.decode(binary) as PGFParameters
}

//class PGFParameters extends Struct(
  //["stewards",                set(addr)],
  //["pgf_inflation_rate",      u256],
  //["stewards_inflation_rate", u256],
//) {
  //declare stewards:              Set<Address>
  //declare pgfInflationRate:      bigint
  //declare stewardsInflationRate: bigint
//}

export async function getPGFStewards (connection: Connection) {
  throw new Error("not implemented")
}

//class PGFSteward extends Struct() { [>TODO<] }

export async function getPGFFundings (connection: Connection) {
  throw new Error("not implemented")
}

//class PGFFunding extends Struct() { [>TODO<] }

export async function isPGFSteward (connection: Connection) {
  throw new Error("not implemented")
}

//export class UpdateStewardCommission extends Struct(
  //['steward',    addr],
  //['commission', map(addr, i256)]
//) {
  //declare steward:    Address
  //declare commission: Map<string, bigint>
//}

//export class ResignSteward extends Struct(
  //["steward", addr],
//) {
  //declare steward: Address
//}

//export {
  //PGFParameters as Parameters,
  //PGFSteward    as Steward,
  //PGFFunding    as Funding,
//}
