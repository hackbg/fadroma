import { CLI } from '../cw-base'
import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { brailleDump } from '@hackbg/dump'
import { CWConnection } from '../cw-connection'
import { CWBatch } from '../cw-batch'
import { NamadaConnection } from './namada-connection'
import { NamadaMnemonicIdentity } from './namada-identity'
import { decodeAddress } from './namada-address'

/** Namada CLI commands. */
class NamadaCLI extends CLI {

  epoch = this.command({
    name: "epoch",
    info: "query current epoch number",
    args: "RPC_URL",
  }, async (url) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query the epoch.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const epochResult = await connection.getCurrentEpoch()
    this.log.log(epochResult)
    process.exit(0)
  });

  totalStaked = this.command({
    name: "total-staked",
    info: "query total staked amount",
    args: "RPC_URL",
  }, async (url) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query total tokens staked.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const totalStaked = await connection.getTotalStaked()
    this.log.log(totalStaked)
    process.exit(0)
  })

  stakingParameters = this.command({
    name: 'staking-parameters',
    info: 'query staking parameters',
    args: 'RPC_URL',
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query governance parameters.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const parameters = await connection.getStakingParameters()
    console.log({parameters})
    process.exit(0)
  })

  validatorList = this.command({
    name: 'validator-list',
    info: 'query all validator addresses',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const validatorAddresses = await connection.getValidatorAddresses()
    for (const validator of await connection.getValidatorAddresses()) {
      this.log.log(validator)
    }
    this.log.br().info('Total validators:', Core.bold(String(validatorAddresses.length)))
    //for (const validator of await connection.getValidators({ prefix: 'tnam' })) {
      //this.log.br()
        ////.info('Validator:        ', Core.bold(validator.address))
        //.info('Address (hex):    ', Core.bold(validator.addressHex))
        //.info('Public key:       ', Core.bold(validator.pubKeyHex))
        //.info('Voting power:     ', Core.bold(String(validator.votingPower)))
        //.info('Proposer priority:', Core.bold(String(validator.proposerPriority)))
    //}
    process.exit(0)
  })

  validatorSetConsensus = this.command({
    name: 'validators-consensus',
    info: 'query validators that participate in the consensus set',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    for (const {address, bondedStake} of await connection.getValidatorsConsensus()) {
      this.log.log(Core.bold(address), bondedStake.toString())
    }
    process.exit(0)
  })

  validatorSetBelowCapacity = this.command({
    name: 'validators-below-capacity',
    info: 'query validators that are below capacity',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    for (const {address, bondedStake} of await connection.getValidatorsBelowCapacity()) {
      this.log.log(Core.bold(address), bondedStake.toString())
    }
    process.exit(0)
  })

  validators = this.command({
    name: 'validators',
    info: 'query metadata for each consensus validator',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const validators = await connection.getValidators({ details: false })
    for (const i in validators) {
      const validator = validators[i]
      this.log.br()
      await validator.fetchDetails(connection)
      this.log.br()
      validator.print()
      this.log.info(`(${Number(i)+1}/${validators.length})`)
    }
    process.exit(0)
  })

  validatorsAll = this.command({
    name: 'validators-all',
    info: 'query metadata for all validators',
    args: 'RPC_URL PAGE PER_PAGE'
  }, async (url: string, page: number, perPage: number) => {
    page = Number(page)
    perPage = Number(perPage)
    if (!url || isNaN(page) || isNaN(perPage)) {
      this.log.error(Core.bold('Pass a RPC URL, page number, and page size to query validators.'))
      process.exit(1)
    }
    if (page < 1) {
      this.log.error(Core.bold('Pages start from 1.'))
      process.exit(1)
    }
    if (perPage < 1) {
      this.log.error(Core.bold('Need to specify at least 1 result per page'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const allValidators = await connection.getValidators({ allStates: true, details: false })
    this.log.info(`Total validators: ${allValidators.length}`)
    const maxPage = Math.floor(allValidators.length / perPage) + 1
    if (page > maxPage) {
      this.log.error(`Max page: ${maxPage}`)
      process.exit(1)
    }
    this.log(`Querying info for validators from #${(page-1)*perPage+1} to #${page*perPage+1}...`)
    const details = await connection.getValidators({
      addresses: allValidators.map(validator=>validator.namadaAddress),
      allStates: true,
      pagination: [ page, perPage ],
      details: true
    })
    for (const validator of details) {
      this.log.br()
      validator.print(this.log)
    }
    process.exit(0)
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
    const validator = await connection.getValidator(address)
    this.log.br()
    validator.print(this.log)
    this.log.br()
    process.exit(0)
  })

  validatorStake = this.command({
    name: "validator-stake",
    info: "query staked amount by validator",
    args: "RPC_URL ADDRESS"
  }, async(url, address) => {
    const connection = new NamadaConnection({ url })
    const stakedByAddress = await connection.getValidatorStake(address)
    this.log.log(stakedByAddress)
    process.exit(0)
  })

  governanceParameters = this.command({
    name: 'governance-parameters',
    info: 'query governance parameters',
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
    process.exit(0)
  })

  proposalCount = this.command({
    name: 'proposal-count',
    info: 'query number of last proposal',
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
    info: 'query info about a proposal by number',
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
      .log('Author:     ', Core.bold(proposal.author))
      .log('Type:       ', Core.bold(JSON.stringify(proposal.type)))
      .log('Start epoch:', Core.bold(proposal.votingStartEpoch))
      .log('End epoch:  ', Core.bold(proposal.votingEndEpoch))
      .log('Grace epoch:', Core.bold(proposal.graceEpoch))
      .log()
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${Core.bold(key)}:`)
        .log(`    ${value}`)
    }
    if (result) {
      const {
        totalVotingPower,
        turnout,           turnoutPercent,
        totalAbstainPower, abstainPercent,
        totalYayPower,     yayPercent,
        totalNayPower,     nayPercent,
      } = result
      this.log
        .log()
        .log('Votes:       ', Core.bold(votes.length))
        .log('Result:      ', Core.bold(JSON.stringify(result.result)))
        .log('  Tally type:', Core.bold(JSON.stringify(result.tallyType)))
        .log('  Yay:       ', Core.bold(yayPercent),
           `of turnout`, `(${Core.bold(totalYayPower)})`)
        .log('  Nay:       ', Core.bold(nayPercent),
           `of turnout`, `(${Core.bold(totalNayPower)})`)
        .log('  Abstain:   ', Core.bold(abstainPercent),
           `of turnout`, `(${Core.bold(totalAbstainPower)})`)
        .log('  Turnout:   ', Core.bold(turnoutPercent),
           `of total voting power`, `(${Core.bold(turnout)})`)
        .log('  Power:     ', Core.bold(result.totalVotingPower))
        .log()
        .info('Use the', Core.bold('proposal-votes'), 'command to see individual votes.')
    } else {
      this.log
        .log()
        .log(Core.bold('There is no result for this proposal yet.'))
        .log()
    }
    process.exit(0)
  })

  proposalVotes = this.command({
    name: 'proposal-votes',
    info: 'query list of individual votes for a proposal',
    args: 'RPC_URL NUMBER'
  }, async (url: string, number: string) => {
    if (!url || !number || isNaN(Number(number))) {
      this.log.error(Core.bold('Pass a RPC URL and proposal number to query proposal votes.'))
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
      .log()
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${Core.bold(key)}:`)
        .log(`    ${value}`)
    }
    if (votes.length > 0) {
      for (const vote of votes) {
        this.log
          .log()
          .log(`Vote:`, Core.bold(vote.value))
          .log(`  Validator:`, Core.bold(vote.validator))
          .log(`  Delegator:`, Core.bold(vote.delegator))
      }
      this.log.log()
    } else {
      this.log.log()
        .log(Core.bold("There are no votes for this proposal yet."))
        .log()
    }
    process.exit(0)
  })
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
