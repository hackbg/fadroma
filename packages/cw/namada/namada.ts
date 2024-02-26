import { CLI } from '../cw-base'
import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { CWConnection, CWBatch } from '../cw-connection'
import { brailleDump } from '@hackbg/dump'
import { NamadaConnection } from './namada-connection'
import { NamadaMnemonicIdentity } from './namada-identity'
export * from './namada-proposal'

/** Namada CLI commands. */
class NamadaCLI extends CLI {

  validators = this.command({
    name: 'validators',
    info: 'query validators for a RPC endpoint',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const validators = await connection.getValidators({ prefix: 'tnam' })
    for (const validator of validators) {
      this.log.br()
        .info('Validator:        ', Core.bold(validator.address))
        .info('Address (hex):    ', Core.bold(validator.addressHex))
        .info('Public key:       ', Core.bold(validator.pubKeyHex))
        .info('Voting power:     ', Core.bold(String(validator.votingPower)))
        .info('Proposer priority:', Core.bold(String(validator.proposerPriority)))
    }
    this.log.br().info('Total validators:', Core.bold(String(validators.length)))
  })

  validator = this.command({
    name: 'validator',
    info: 'query info about a validator',
    args: 'RPC_URL ADDRESS'
  }, async (url: string, address: string) => {
    if (!url || !address) {
      this.log.error(Core.bold('Pass a RPC URL and an address to query validator info.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const { metadata } = await connection.getValidatorMetadata(address)
    this.log.br()
      .log('Address:     ', Core.bold(address))
      .log('Email:       ', Core.bold(metadata.email))
    if (metadata.website) {
      this.log('Website:     ', Core.bold(metadata.website))
    }
    if (metadata.discord_handle) {
      this.log('Discord:     ', Core.bold(metadata.discord_handle))
    }
    if (metadata.avatar) {
      this.log('Avatar:      ', Core.bold(metadata.avatar))
    }
    if (metadata.description) {
      this.log('Description: ', Core.bold(metadata.description))
    }
    process.exit(0)
  })

  governanceParameters = this.command({
    name: 'governance-parameters',
    info: 'get governance parameters',
    args: 'RPC_URL',
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query governance parameters.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const parameters = await connection.getGovernanceParameters()
    this.log
      .log()
      .log('Minimum proposal fund:         ', Core.bold(parameters.minProposalFund))
      .log('Minimum proposal voting period:', Core.bold(parameters.minProposalVotingPeriod))
      .log('Minimum proposal grace epochs: ', Core.bold(parameters.minProposalGraceEpochs))
      .log()
      .log('Maximum proposal period:       ', Core.bold(parameters.maxProposalPeriod))
      .log('Maximum proposal content size: ', Core.bold(parameters.maxProposalContentSize))
      .log('Maximum proposal code size:    ', Core.bold(parameters.maxProposalCodeSize))
      .log()
  })

  proposalCount = this.command({
    name: 'proposal-count',
    info: 'get number of last proposal',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query proposal counter.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const counter = await connection.getProposalCount()
    this.log
      .log('Proposal count:', Core.bold(String(counter)))
      .log('Last proposal: ', Core.bold(String(counter-1n)))
      .info('Use the', Core.bold('proposal'), 'command to query proposal details.')
    process.exit(0)
  })

  proposal = this.command({
    name: 'proposal',
    info: 'get info about a proposal by number',
    args: 'RPC_URL NUMBER'
  }, async (url: string, number: string) => {
    if (!url || !number || isNaN(Number(number))) {
      this.log.error(Core.bold('Pass a RPC URL and proposal number to query proposal info.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const {proposal, votes, result} = await connection.getProposalInfo(Number(number))
    this.log
      .log()
      .log('Proposal:   ', Core.bold(number))
      .log('Author:     ', Core.bold(JSON.stringify(proposal.author)))
      .log('Type:       ', Core.bold(JSON.stringify(proposal.type)))
      .log('Start epoch:', Core.bold(proposal.votingStartEpoch))
      .log('End epoch:  ', Core.bold(proposal.votingEndEpoch))
      .log('Grace epoch:', Core.bold(proposal.graceEpoch))
      .log('Votes:      ', Core.bold(votes.length))
      .info('Use the', Core.bold('proposal-votes'), 'command to see individual votes.')
      .log()
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${Core.bold(key)}:`)
        .log(`    ${value}`)
    }
    console.log({result})
    process.exit(0)
  })

  proposalVotes = this.command({
    name: 'proposal-votes',
    info: 'list of individual votes for a proposal',
    args: 'RPC_URL NUMBER'
  }, async (url: string, number: string) => {
    if (!url || !number || isNaN(Number(number))) {
      this.log.error(Core.bold('Pass a RPC URL and proposal number to query proposal votes.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const {proposal, votes, result} = await connection.getProposalInfo(Number(number))
    this.log
      .log('Proposal:   ', Core.bold(number))
      .log('Author:     ', Core.bold(JSON.stringify(proposal.author)))
      .log('Type:       ', Core.bold(JSON.stringify(proposal.type)))
      .log('Start epoch:', Core.bold(proposal.votingStartEpoch))
      .log('End epoch:  ', Core.bold(proposal.votingEndEpoch))
      .log('Grace epoch:', Core.bold(proposal.graceEpoch))
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${Core.bold(key)}:`)
        .log(`    ${value}`)
    }
    for (const vote of votes) {
      this.log
        .log()
        .log(`Vote:`, Core.bold(JSON.stringify(vote.data)))
        .log(`  Validator:`, Core.bold(JSON.stringify(vote.validator)))
        .log(`  Delegator:`, Core.bold(JSON.stringify(vote.delegator)))
    }
    process.exit(0)
  })

}

type ValidatorMetaData = {
  email:          string
  description:    string|null
  website:        string|null
  discord_handle: string|null
  avatar:         string|null
}

export {
  NamadaCLI              as CLI,
  NamadaConnection       as Connection,
  NamadaMnemonicIdentity as MnemonicIdentity
}

export const chainIds = {
  testnet: 'luminara.4d6026bc59ee20d9664d3'
}

export const testnets = new Set([
  'https://rpc.luminara.icu'
])

export const faucets = {
  'luminara.4d6026bc59ee20d9664d3': new Set([
    'https://faucet.luminara.icu/'
  ])
}

/** Connect to Namada in testnet mode. */
export const testnet = (options: Partial<NamadaConnection> = {}): NamadaConnection => {
  return new NamadaConnection({
    chainId: chainIds.testnet, url: Core.pickRandom(testnets), ...options||{}
  })
}
