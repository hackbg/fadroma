import { Core } from '@fadroma/cw'

export class InitProposal {
  static noun = 'Proposal Init'
  print (console) {
    throw new Error('print InitProposal: not implemented')
  }
}

export class VoteProposal {
  static noun = 'Proposal Vote'
  id: bigint
  vote
  voter
  delegations: unknown[]
  print (console) {
    console.log(Core.bold('  Decoded VoteProposal:'))
      .log('    Proposal ID:', Core.bold(this.id))
      .log('    Vote:       ', Core.bold(JSON.stringify(this.vote)))
      .log('    Voter:      ', Core.bold(JSON.stringify(this.voter)))
      .log('    Delegations:', Core.bold(JSON.stringify(this.delegations)))
  }
}
