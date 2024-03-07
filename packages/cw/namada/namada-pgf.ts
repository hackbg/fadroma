import type { Address } from './namada-address'
import { addressSchema } from './namada-address'
import { u256Schema, decodeU256Fields } from './namada-u256'
import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { fromBorshStruct } from './namada-struct'
const Schema = Borsher.BorshSchema

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

export async function getPGFParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return PGFParameters.fromBorsh(binary) as PGFParameters
}

class PGFParameters extends fromBorshStruct({
  stewards:                Schema.HashSet(addressSchema),
  pgf_inflation_rate:      u256Schema,
  stewards_inflation_rate: u256Schema,
}) {
  stewards!:               Set<Address>
  pgfInflationRate!:       bigint
  stewardsInflationRate!:  bigint
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

class PGFSteward extends fromBorshStruct({}) { /*TODO*/ }

export async function getPGFFundings (connection: Connection) {
  throw new Error("not implemented")
}

class PGFFunding extends fromBorshStruct({}) { /*TODO*/ }

export async function isPGFSteward (connection: Connection) {
  throw new Error("not implemented")
}

export class UpdateStewardCommission extends fromBorshStruct({
  steward:    addressSchema,
  commission: Schema.HashMap(addressSchema, Dec)
}) {
  steward:    Address
  commission: Map<string, bigint>
}

export class ResignSteward extends fromBorshStruct({
  steward: addressSchema,
}) {}

export {
  PGFParameters as Parameters,
  PGFSteward    as Steward,
  PGFFunding    as Funding,
}
