import type { Address } from './namada-address'
import { addressSchema } from './namada-address'
import { u256Schema, decodeU256Fields } from './namada-u256'
import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
const Schema = Borsher.BorshSchema

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

export async function getPGFParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return PGFParameters.fromBorsh(binary)
}

export class PGFParameters {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(pgfParametersSchema, binary))
  stewards!:              Set<Address>
  pgfInflationRate!:      bigint
  stewardsInflationRate!: bigint
  constructor (data: Partial<PGFParameters> = {}) {
    Core.assignCamelCase(this, data, Object.keys(pgfParametersFields))
    decodeU256Fields(this, [
      "pgfInflationRate",
      "stewardsInflationRate"
    ])
  }
}

const pgfParametersFields = {
  stewards:                Schema.HashSet(addressSchema),
  pgf_inflation_rate:      u256Schema,
  stewards_inflation_rate: u256Schema,
}

const pgfParametersSchema = Schema.Struct(pgfParametersFields)

export async function getPGFStewards (connection: Connection) {
  throw new Error("not implemented")
}

export class PGFSteward {}

const pgfStewardFields = {}

const pgfStewardSchema = Schema.Struct(pgfStewardFields)

export async function getPGFFundings (connection: Connection) {
  throw new Error("not implemented")
}

export class PGFFunding {}

const pgfFundingFields = {}

const pgfFundingSchema = Schema.Struct(pgfFundingFields)

export async function isPGFSteward (connection: Connection) {
  throw new Error("not implemented")
}
