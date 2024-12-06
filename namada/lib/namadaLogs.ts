import { Console, bold } from '../deps.ts'
import type * as Namada from './namadaTypes.ts'

class NamadaConsole extends Console {

  warnNoDecoder () {
    this.warn("Decoder binary not provided; trying to decode Namada objects will fail.")
  }

  printTx (tx: Partial<Namada.Transaction> = {}) {
    this.log('-', bold(`${tx.data?.txType} transaction:`))
      .log('  Chain ID:  ', bold(tx.chain?.id))
      .log('  Timestamp: ', bold(tx.data?.timestamp))
      .log('  Expiration:', bold(tx.data?.expiration))
      .log('  Sections:  ', bold(tx.data?.sections?.length))
  }

  printValidator (validator: Namada.Validator) {
    return this
      .log('Validator:      ', bold(validator.namadaAddress))
      .log('  Address:      ', bold(validator.address))
      .log('  Public key:   ', bold(validator.publicKey))
      .log('  State:        ', bold(Object.keys(validator.state as object)[0]))
      .log('  Stake:        ', bold(validator.stake))
      .log('  Voting power: ', bold(validator.votingPower))
      .log('  Priority:     ', bold(validator.proposerPriority))
      .log('  Commission:   ', bold(validator.commission?.commissionRate))
      .log('    Max change: ', bold(validator.commission?.maxCommissionChangePerEpoch), 'per epoch')
      .log('Email:          ', bold(validator.metadata?.email||''))
      .log('Website:        ', bold(validator.metadata?.website||''))
      .log('Discord:        ', bold(validator.metadata?.discordHandle||''))
      .log('Avatar:         ', bold(validator.metadata?.avatar||''))
      .log('Description:    ', bold(validator.metadata?.description||''))
  }

  printVoteProposal (proposal: {
    id:          unknown
    vote:        unknown
    voter:       unknown
    delegations: unknown
  }) {
    return this.log(bold('  Decoded VoteProposal:'))
      .log('    Proposal ID:', bold(proposal.id))
      .log('    Vote:       ', bold(JSON.stringify(proposal.vote)))
      .log('    Voter:      ', bold(JSON.stringify(proposal.voter)))
      .log('    Delegations:', bold(JSON.stringify(proposal.delegations)))
  }

}

export {
  NamadaConsole as Console
}
