import * as Base from '../deps.ts'
import type { Api } from './tmApi.ts'

export interface Chain extends Base.ChainBase<Connection> {
  bech32Prefix?: string
}

export interface Connection extends Base.Connection {
  url: string|URL
}

export interface Validator {
  address?:         Base.Address
  publicKey?:       Base.Hash
  votingPower:      bigint
  proposerPriority: bigint
}

export interface Transaction extends Base.Transaction {
  chain: Chain
  hash:  Base.Hash
}

export interface Block extends Base.Block {
  hash: unknown
}

export type ProposalId = bigint

export type ProposalResult = 'Pass'|'Fail'

export interface Proposal {
  id:     ProposalId
  votes:  Vote[]
  result: ProposalResult
}

export type VoteValue = 'Yay'|'Nay'|'Abstain'

export interface Vote {
  proposal: ProposalId
  voter:    Base.Address
  power:    bigint
  value:    VoteValue
}
