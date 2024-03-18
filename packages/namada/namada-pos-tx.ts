import { Core } from '@fadroma/cw'

export class BecomeValidator {
  static noun = 'Become Validator'
  address!:                 string
  consensusKey!:            string
  ethColdKey!:              string
  ethHotKey!:               string
  protocolKey!:             string
  commissionRate!:          bigint
  maxCommissionRateChange!: bigint
  email!:                   string
  description!:             string
  website!:                 string
  discordHandle!:           string
  avatar!:                  string
  constructor (properties: Partial<BecomeValidator> = {}) {
    Core.assign(this, properties, [
      'address',
      'consensusKey',
      'ethColdKey',
      'ethHotKey',
      'protocolKey',
      'commissionRate',
      'maxCommissionRateChange',
      'email',
      'description',
      'website',
      'discordHandle',
      'avatar',
    ])
  }
}

export class Bond {
  static noun = 'Bonding'
  validator!: string
  amount!:    bigint
  source!:    null|string
  constructor (properties: Partial<Bond> = {}) {
    Core.assign(this, properties, [
      'validator',
      'amount',
      'source',
    ])
  }
}

export class ClaimRewards {
  static noun = 'Rewards Claim'
  validator!: string
  source!:    null|string
  constructor (properties: Partial<ClaimRewards> = {}) {
    Core.assign(this, properties, [
      'validator',
      'source'
    ])
  }
}

export class ConsensusKeyChange {
  static noun = 'Validator Consensus Key Change'
  validator!:    string
  consensusKey!: unknown
  constructor (properties: Partial<ConsensusKeyChange> = {}) {
    Core.assign(this, properties, [
      'validator',
      'consensusKey'
    ])
  }
}

export class CommissionChange {
  static noun = 'Validator Commission Change'
  validator!: string
  newRate!:   bigint
  constructor (properties: Partial<CommissionChange> = {}) {
    Core.assign(this, properties, [
      'validator',
      'newRate'
    ])
  }
}

export class MetaDataChange {
  static noun = 'Validator Metadata Change'
  validator!:      string
  email!:          null|string
  description!:    null|string
  website!:        null|string
  discordHandle!:  null|string
  avatar!:         null|string
  commissionRate!: null|string
  constructor (properties: Partial<MetaDataChange> = {}) {
    Core.assign(this, properties, [
      'validator',
      'email',
      'description',
      'website',
      'discordHandle',
      'avatar',
      'commissionRate'
    ])
  }
}

export class Redelegation {
  static noun = 'Redelegation'
  srcValidator!:   string
  destValidator!:  string
  owner!:          string
  amount!:         bigint
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'srcValidator',
      'destValidator',
      'owner',
      'amount'
    ])
  }
}

export class Unbond {
  static noun = 'Unbonding'
  validator!: string
  amount!:    bigint
  source!:    null|string
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'validator',
      'amount',
      'source',
    ])
  }
}

export class Withdraw {
  static noun = 'Withdrawal'
  validator!: string
  source!:    null|string
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'validator',
      'source',
    ])
  }
}

export class DeactivateValidator {
  static noun = 'Validator Deactivation'
  address!: string
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'address'
    ])
  }
}

export class ReactivateValidator {
  static noun = 'Validator Reactivation'
  address!: string
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'address'
    ])
  }
}

export class UnjailValidator {
  static noun = 'Validator Unjail'
  address!: string
  constructor (properties: Partial<Redelegation> = {}) {
    Core.assign(this, properties, [
      'address'
    ])
  }
}
