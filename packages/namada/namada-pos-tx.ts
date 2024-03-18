export class BecomeValidator {
  static noun = 'Become Validator'
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
}

export class Bond {
  static noun = 'Bonding'
  validator: string
  amount:    bigint
  source:    null|string
}

export class ClaimRewards {
  static noun = 'Rewards Claim'
  validator: string
  source:    null|string
}

export class ConsensusKeyChange {
  static noun = 'Validator Consensus Key Change'
  validator:     string
  consensusKey:  unknown
}

export class CommissionChange {
  static noun = 'Validator Commission Change'
  validator: string
  newRate:   bigint
}

export class MetaDataChange {
  static noun = 'Validator Metadata Change'
  validator:      string
  email:          null|string
  description:    null|string
  website:        null|string
  discordHandle:  null|string
  avatar:         null|string
  commissionRate: null|string
}

export class Redelegation {
  static noun = 'Redelegation'
  srcValidator:   string
  destValidator:  string
  owner:          string
  amount:         bigint
}

export class Unbond {
  static noun = 'Unbonding'
  validator: string
  amount:    bigint
  source:    null|string
}

export class Withdraw {
  static noun = 'Withdrawal'
  validator: string
  source:    null|string
}

export class DeactivateValidator {
  static noun = 'Validator Deactivation'
  address: string
}

export class ReactivateValidator {
  static noun = 'Validator Reactivation'
  address: string
}

export class UnjailValidator {
  static noun = 'Validator Unjail'
  address: string
}
