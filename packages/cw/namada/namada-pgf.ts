import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import type { Address } from './namada-address'
import { addressSchema } from './namada-address'
import {
  schemaEnum,
  enumVariant,
  u256Schema,
  i256Schema,
  decodeU256Fields
} from './namada-types'
import { Struct, set, u256, i256, map } from '@hackbg/borshest'

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

export async function getPGFParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return PGFParameters.decode(binary) as PGFParameters
}

class PGFParameters extends Struct(
  ["stewards",                set(addressSchema)],
  ["pgf_inflation_rate",      u256],
  ["stewards_inflation_rate", u256],
) {
  declare stewards:              Set<Address>
  declare pgfInflationRate:      bigint
  declare stewardsInflationRate: bigint
  constructor (data) {
    super(data)
    decodeU256Fields(this, [
      "pgfInflationRate",
      "stewardsInflationRate"
    ])
  }
}

export async function getPGFStewards (connection: Connection) {
  throw new Error("not implemented")
}

class PGFSteward extends Struct() { /*TODO*/ }

export async function getPGFFundings (connection: Connection) {
  throw new Error("not implemented")
}

class PGFFunding extends Struct() { /*TODO*/ }

export async function isPGFSteward (connection: Connection) {
  throw new Error("not implemented")
}

export class UpdateStewardCommission extends Struct(
  ['steward',    addressSchema],
  ['commission', map(addressSchema, i256)]
) {
  declare steward:    Address
  declare commission: Map<string, bigint>
}

export class ResignSteward extends Struct(
  ["steward", addressSchema],
) {
  declare steward: Address
}

export {
  PGFParameters as Parameters,
  PGFSteward    as Steward,
  PGFFunding    as Funding,
}
