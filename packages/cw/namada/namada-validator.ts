import * as Borsher from 'borsher'
import type { Address } from '@fadroma/agent'
import { addressSchema, InternalAddresses } from './namada-address'
import { u256Schema, decodeU256Fields } from './namada-u256'
import { schemaEnum } from './namada-enum'
import { Core } from '@fadroma/agent'

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

const Schema = Borsher.BorshSchema

export async function getValidatorMetadata (connection: Connection, address: Address) {
  const [ metadata, commission, state ] = await Promise.all([
    `/vp/pos/validator/metadata/${address}`,
    `/vp/pos/validator/commission/${address}`,
    `/vp/pos/validator/state/${address}`,
  ].map(path => connection.abciQuery(path)))
  return {
    metadata:   ValidatorMetaData.fromBorsh(metadata),
    commission: CommissionPair.fromBorsh(commission),
    state:      Borsher.borshDeserialize(stateSchema, state),
  }
}

export class ValidatorMetaData {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(validatorMetaDataSchema, binary))
  email:         string
  description:   string|null
  website:       string|null
  discordHandle: string|null
  avatar:        string|null
  constructor (data: Partial<ValidatorMetaData> = {}) {
    Core.assignCamelCase(this, data, Object.keys(validatorMetaDataSchemaFields))
  }
}

const validatorMetaDataSchemaFields = {
  email:          Schema.String,
  description:    Schema.Option(Schema.String),
  website:        Schema.Option(Schema.String),
  discord_handle: Schema.Option(Schema.String),
  avatar:         Schema.Option(Schema.String),
}

const validatorMetaDataSchema = Schema.Option(Schema.Struct(
  validatorMetaDataSchemaFields
))

export class CommissionPair {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(commissionPairSchema, binary))
  commissionRate:              bigint
  maxCommissionChangePerEpoch: bigint
  constructor (data: Partial<CommissionPair> = {}) {
    Core.assignCamelCase(this, data, Object.keys(commissionPairSchemaFields))
    decodeU256Fields(this, [
      'commissionRate',
      'maxCommissionChangePerEpoch',
    ])
  }
}

const commissionPairSchemaFields = {
  commission_rate:                 u256Schema,
  max_commission_change_per_epoch: u256Schema,
}

const commissionPairSchema = Schema.Struct(commissionPairSchemaFields)

const stateSchema = schemaEnum([
  ['Consensus',      Schema.Unit],
  ['BelowCapacity',  Schema.Unit],
  ['BelowThreshold', Schema.Unit],
  ['Inactive',       Schema.Unit],
  ['Jailed',         Schema.Unit],
])
