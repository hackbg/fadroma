import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { addressSchema } from './namada-address'
const { BorshSchema: Schema, borshDeserialize: deserialize } = Borsher

const txBecomeValidatorFields = {
  address:                    addressSchema,
  consensus_key:              PublicKey,
  eth_cold_key:               PublicKey,
  eth_hot_key:                PublicKey,
  protocol_key:               PublicKey,
  commission_rate:            Dec,
  max_commission_rate_change: Dec,
  email:                      Schema.String,
  description:                Schema.Option(Schema.String),
  website:                    Schema.Option(Schema.String),
  discord_handle:             Schema.Option(Schema.String),
  avatar:                     Schema.Option(Schema.String)
}
const txBecomeValidatorSchema = Schema.Struct(txBecomeValidatorFields)
export class TXBecomeValidator {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txBecomeValidatorSchema, binary)
  )
  address
  consensusKey
  ethColdKey
  ethHotKey
  protocolKey
  commissionRate
  maxCommissionRateChange
  email
  description
  website
  discordHandle
  avatar
  constructor (data) {
    Core.assignCamelCase(this, data, Object.keys(txBecomeValidatorFields))
  }
}

const txBondFields = {
  validator: addressSchema,
  amount:    Amount,
  source:    Schema.Option(addressSchema)
}
const txBondSchema = Schema.Struct(txBondFields)
export class TXBond {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txBondSchema, binary)
  )
  validator
  amount
  source
  constructor (data) {
    Core.assignCamelCase(this, data, Object.keys(txBondFields))
  }
}

const txBridgePoolFields = {}
const txBridgePoolSchema = Schema.Struct(txBridgePoolFields)
export class TXBridgePool {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txBridgePoolSchema, binary)
  )
}

const txChangeConsensusKeyFields = {}
const txChangeConsensusKeySchema = Schema.Struct(txChangeConsensusKeyFields)
export class TXChangeConsensusKey {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txChangeConsensusKeySchema, binary)
  )
  validator
  consensusKey
}

const txChangeValidatorCommissionFields = {}
const txChangeValidatorCommissionSchema = Schema.Struct(txChangeValidatorCommissionFields)
export class TXChangeValidatorCommission {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txChangeValidatorCommissionSchema, binary)
  )
  validator
  newRate
}

const txChangeValidatorMetadataFields = {}
const txChangeValidatorMetadataSchema = Schema.Struct(txChangeValidatorMetadataFields)
export class TXChangeValidatorMetadata {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txChangeValidatorMetadataSchema, binary)
  )
  validator
  email
  description
  website
  discordHandle
  avatar
  commissionRate
}

const txClaimRewardsFields = {}
const txClaimRewardsSchema = Schema.Struct(txClaimRewardsFields)
export class TXClaimRewards {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txClaimRewardsSchema, binary)
  )
  validator
  source
}

const txDeactivateValidatorFields = {}
const txDeactivateValidatorSchema = Schema.Struct(txDeactivateValidatorFields)
export class TXDeactivateValidator {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txDeactivateValidatorSchema, binary)
  )
}

const txIBCFields = {}
const txIBCSchema = Schema.Struct(txIBCFields)
export class TXIBC {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txIBCSchema, binary)
  )
}

const txInitAccountFields = {}
const txInitAccountSchema = Schema.Struct(txInitAccountFields)
export class TXInitAccount {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txInitAccountSchema, binary)
  )
}

const txInitProposalFields = {}
const txInitProposalSchema = Schema.Struct(txInitProposalFields)
export class TXInitProposal {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txInitProposalSchema, binary)
  )
}

const txReactivateValidatorFields = {}
const txReactivateValidatorSchema = Schema.Struct(txReactivateValidatorFields)
export class TXReactivateValidator {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txReactivateValidatorSchema, binary)
  )
}

const txRedelegateFields = {}
const txRedelegateSchema = Schema.Struct(txRedelegateFields)
export class TXRedelegate {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txRedelegateSchema, binary)
  )
}

const txResignStewardFields = {}
const txResignStewardSchema = Schema.Struct(txResignStewardFields)
export class TXResignSteward {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txResignStewardSchema, binary)
  )
}

const txRevealPKFields = {}
const txRevealPKSchema = Schema.Struct(txRevealPKFields)
export class TXRevealPK {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txRevealPKSchema, binary)
  )
}

const txTransferFields = {}
const txTransferSchema = Schema.Struct(txTransferFields)
export class TXTransfer {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txTransferSchema, binary)
  )
}

const txUnbondFields = {}
const txUnbondSchema = Schema.Struct(txUnbondFields)
export class TXUnbond {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txUnbondSchema, binary)
  )
}

const txUnjailValidatorFields = {}
const txUnjailValidatorSchema = Schema.Struct(txUnjailValidatorFields)
export class TXUnjailValidator {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txUnjailValidatorSchema, binary)
  )
}

const txUpdateAccountFields = {}
const txUpdateAccountSchema = Schema.Struct(txUpdateAccountFields)
export class TXUpdateAccount {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txUpdateAccountSchema, binary)
  )
}

const txUpdateStewardCommissionFields = {}
const txUpdateStewardCommissionSchema = Schema.Struct(txUpdateStewardCommissionFields)
export class TXUpdateStewardCommission {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txUpdateStewardCommissionSchema, binary)
  )
}

const txVoteProposalFields = {}
const txVoteProposalSchema = Schema.Struct(txVoteProposalFields)
export class TXVoteProposal {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txVoteProposalSchema, binary)
  )
}

const txWithdrawFields = {}
const txWithdrawSchema = Schema.Struct(txWithdrawFields)
export class TXWithdraw {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(txWithdrawSchema, binary)
  )
}

const vpImplicitFields = {}
const vpImplicitSchema = Schema.Struct(vpImplicitFields)
export class VPImplicit {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(vpImplicitSchema, binary)
  )
}

const vpUserFields = {}
const vpUserSchema = Schema.Struct(vpUserFields)
export class VPUser {
  static fromBorsh = (binary: Uint8Array) => new this(
    deserialize(vpUserSchema, binary)
  )
}
