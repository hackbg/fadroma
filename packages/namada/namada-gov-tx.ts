import { Core } from '@fadroma/cw'

export class InitProposal {
  static noun = 'Proposal Init'
  id!:               bigint
  content!:          string
  author!:           string
  type!:             unknown
  votingStartEpoch!: bigint
  votingEndEpoch!:   bigint
  graceEpoch!:       bigint
  constructor (properties: Partial<InitProposal> = {}) {
    Core.assign(this, properties, [
      "id",
      "content",
      "author",
      "type",
      "votingStartEpoch",
      "votingEndEpoch",
      "graceEpoch",
    ])
  }
}

export class VoteProposal {
  static noun = 'Proposal Vote'
  id!:          bigint
  vote!:        unknown
  voter!:       unknown
  delegations!: unknown[]
  constructor (properties: Partial<VoteProposal> = {}) {
    Core.assign(this, properties, [
      "id",
      "vote",
      "voter",
      "delegations"
    ])
  }
}
