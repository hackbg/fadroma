import { Core } from '@fadroma/agent'
import type { Transaction } from './namada-tx-base'
import type { VoteProposal } from './namada-gov-tx'
import * as Sections from './namada-tx-section'
import type {
  Validator
} from './namada-pos'

export class NamadaConsole extends Core.Console {

  printTx (
    {
      txType, chainId, timestamp, expiration, codeHash, dataHash, memoHash, sections
    }: Partial<Transaction> = {},
    indent = 0
  ) {
    this.log('-', Core.bold(`${txType} transaction:`))
      .log('  Chain ID:  ', Core.bold(chainId))
      .log('  Timestamp: ', Core.bold(timestamp))
      .log('  Expiration:', Core.bold(expiration))
      .log('  Code hash: ', Core.bold(codeHash))
      .log('  Data hash: ', Core.bold(dataHash))
      .log('  Memo hash: ', Core.bold(memoHash))
      .log('  Sections:  ', Core.bold(sections?.length))
  }

  printTxSections (
    sections: Array<Partial<Sections.Section>> = [],
    indent = 0
  ) {
    console.log(Core.bold('  Sections:  '))
    for (const section of sections) {
      this.printTxSection(section)
    }
    return true
  }

  printTxSection (
    section: Partial<Sections.Section> = {},
    indent = 0
  ) {
    switch (true) {
      case (section instanceof Sections.Data):
        return this.printDataSection(section)
      case (section instanceof Sections.ExtraData):
        return this.printExtraDataSection(section)
      case (section instanceof Sections.Code):
        return this.printCodeSection(section)
      case (section instanceof Sections.Signature):
        return this.printSignatureSection(section)
      case (section instanceof Sections.Ciphertext):
        return this.printCiphertextSection(section)
      case (section instanceof Sections.MaspTx):
        return this.printMaspTxSection(section)
      case (section instanceof Sections.MaspBuilder):
        return this.printMaspBuilderSection(section)
      default:
        return this.printUnknownSection(section)
    }
  }

  printUnknownSection (
    _: Partial<Sections.Unknown> = {},
    indent = 0
  ) {
    return this.warn('  Section: Unknown')
  }

  printDataSection (
    { salt, data }: Sections.Data,
    indent = 0
  ) {
    return this
      .log('  Section: Data')
      .log('    Salt:', salt)
      .log('    Data:', data)
  }

  printExtraDataSection (
    { salt, code, tag }: Sections.ExtraData,
    indent = 0
  ) {
    return this
      .log('  Section: Extra data')
      .log('    Salt:', salt)
      .log('    Code:', code)
      .log('    Tag: ', tag)
  }

  printCodeSection (
    { salt, code, tag }: Sections.Code,
    indent = 0
  ) {
    return this
      .log('  Section: Code')
      .log('    Salt:', salt)
      .log('    Code:', code)
      .log('    Tag: ', tag)
  }

  printSignatureSection (
    { targets, signer, signatures }: Partial<Sections.Signature> = {},
    indent = 0
  ) {
    this
      .log('  Section: Signature')
      .log('    Targets:   ')
    for (const target of targets||[]) {
      this
        .log('    -', target)
    }
    if (typeof signer === 'string') {
      this
        .log('    Signer:    ', signer)
    } else {
      this
        .log('    Signer:    ')
      for (const sign of signer||[]) {
        this
          .log('    -', sign)
      }
    }
    this
      .log('    Signatures:')
    for (const [key, value] of Object.entries(signatures||{})) {
      this
        .log('    -', key, value)
    }
    return this
  }

  printCiphertextSection (
    _: Partial<Sections.Ciphertext> = {},
    indent = 0
  ) {
    console.log('  Section: Ciphertext')
  }

  printMaspTxSection (
    {
      txid, lockTime, expiryHeight, transparentBundle, saplingBundle
    }: Partial<Sections.MaspTx> = {},
    indent = 0
  ) {
    this
      .log('  MASP TX section')
      .log('    TX ID:    ', txid)
      .log('    Lock time:', lockTime)
      .log('    Expiry:   ', expiryHeight)
    if (transparentBundle) {
      this.log('    Transparent bundle:')
      this.log('    vIn:')
      for (const tx of transparentBundle?.vin||[]) {
        this
          .log('    - Asset type:', tx.assetType)
          .log('      Value:     ', tx.value)
          .log('      Address:   ', tx.address)
      }
      this.log('    vOut:')
      for (const tx of transparentBundle?.vout||[]) {
        this
          .log('    - Asset type:', tx.assetType)
          .log('      Value:     ', tx.value)
          .log('      Address:   ', tx.address)
      }
    }
    if (saplingBundle) {
      this
        .log('  Sapling bundle:')
        .log('    Shielded spends:')
      for (const tx of saplingBundle?.shieldedSpends||[]) {
        this
          .log('    - CV:       ', tx.cv)
          .log('      Anchor:   ', tx.anchor)
          .log('      Nullifier:', tx.nullifier)
          .log('      RK:       ', tx.rk)
          .log('      ZKProof:  ', tx.zkProof)
      }
      this.log('    Shielded converts:')
      for (const tx of saplingBundle?.shieldedConverts||[]) {
        this
          .log('    - CV:     ', tx.cv)
          .log('      Anchor: ', tx.anchor)
          .log('      ZKProof:', tx.zkProof)
      }
      this.log('    Shielded outputs:')
      for (const tx of saplingBundle?.shieldedOutputs||[]) {
        this
          .log('    - CV:             ', tx.cv)
          .log('      CMU:            ', tx.cmu)
          .log('      Epheremeral key:', tx.ephemeralKey)
          .log('      Enc. ciphertext:', tx.encCiphertext)
          .log('      Out. ciphertext:', tx.outCiphertext)
          .log('      ZKProof:        ', tx.zkProof)
      }
    }
    return this
  }

  printMaspBuilderSection (
    _: Partial<Sections.MaspBuilder> = {},
    indent = 0
  ) {
    return this.warn('  Section: MaspBuilder')
  }

  printValidator (validator: Validator) {
    return this
      .log('Validator:      ', Core.bold(validator.namadaAddress))
      .log('  Address:      ', Core.bold(validator.address))
      .log('  Public key:   ', Core.bold(validator.publicKey))
      .log('  State:        ', Core.bold(Object.keys(validator.state as object)[0]))
      .log('  Stake:        ', Core.bold(validator.stake))
      .log('  Voting power: ', Core.bold(validator.votingPower))
      .log('  Priority:     ', Core.bold(validator.proposerPriority))
      .log('  Commission:   ', Core.bold(validator.commission.commissionRate))
      .log('    Max change: ', Core.bold(validator.commission.maxCommissionChangePerEpoch), 'per epoch')
      .log('Email:          ', Core.bold(validator.metadata?.email||''))
      .log('Website:        ', Core.bold(validator.metadata?.website||''))
      .log('Discord:        ', Core.bold(validator.metadata?.discordHandle||''))
      .log('Avatar:         ', Core.bold(validator.metadata?.avatar||''))
      .log('Description:    ', Core.bold(validator.metadata?.description||''))
  }

  printVoteProposal (proposal: VoteProposal) {
    return this.log(Core.bold('  Decoded VoteProposal:'))
      .log('    Proposal ID:', Core.bold(proposal.id))
      .log('    Vote:       ', Core.bold(JSON.stringify(proposal.vote)))
      .log('    Voter:      ', Core.bold(JSON.stringify(proposal.voter)))
      .log('    Delegations:', Core.bold(JSON.stringify(proposal.delegations)))
  }

}
