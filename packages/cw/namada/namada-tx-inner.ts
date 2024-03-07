import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { addressSchema } from './namada-address'
import { fromBorshStruct } from './namada-struct'
const { BorshSchema: Schema, borshDeserialize: deserialize } = Borsher

export class BridgePool extends fromBorshStruct({}) {}

export class IBC extends fromBorshStruct({}) {}

export class InitAccount extends fromBorshStruct({
  public_keys:  Schema.Vec(publicKeySchema),
  vp_code_hash: Schema.Array(Schema.u8, 32),
  threshold:    Schema.u8,
}) {
  publicKeys
  vpCodeHash
  threshold
}

export class ResignSteward extends fromBorshStruct({}) {}

export class RevealPK extends fromBorshStruct({}) {}

export class Transfer extends fromBorshStruct({
  source:   addressSchema,
  target:   addressSchema,
  token:    addressSchema,
  amount:   denominatedAmountSchema,
  key:      Schema.Option(Schema.String),
  shielded: Schema.Option(Schema.Array(Schema.u8, 32))
}) {
  source
  target
  token
  amount
  key
  shielded
}

export class UpdateAccount extends fromBorshStruct({
  addr:         addressSchema,
  vp_code_hash: Schema.Option(Schema.Array(Schema.u8, 32)),
  public_keys:  Schema.Vec(publicKeySchema),
  threshold:    Schema.Option(Schema.u8)
}) {}

export class VPImplicit extends fromBorshStruct({}) {}

export class VPUser extends fromBorshStruct({}) {}
