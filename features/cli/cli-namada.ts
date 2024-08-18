import CLI from '@hackbg/cmds'
import { bold, pickRandom } from '@hackbg/fadroma'
import { brailleDump } from '@hackbg/dump'
import * as Namada from '@fadroma/namada'

/** Namada CLI commands. */
export default class NamadaCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log = new Namada.Console("")
  }

  declare log: Namada.Console

  epoch = this.command({
    name: "epoch",
    info: "query current epoch number",
    args: "RPC_URL",
  }, async (url) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query the epoch.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const epochResult = await namada.getCurrentEpoch()
    this.log.log(epochResult)
    process.exit(0)
  });

  pgf = this.command({
    name: "pgf",
    info: "query pgf parameters",
    args: "RPC_URL"
  }, async (url) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query the epoch.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const pgfParameters = await namada.getPGFParameters()
    this.log.log(pgfParameters)
    process.exit(0)
  })

  totalStaked = this.command({
    name: "total-staked",
    info: "query total staked amount",
    args: "RPC_URL",
  }, async (url) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query total tokens staked.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const totalStaked = await namada.getTotalStaked()
    this.log.log(totalStaked)
    process.exit(0)
  })

  stakingParameters = this.command({
    name: 'staking-parameters',
    info: 'query staking parameters',
    args: 'RPC_URL',
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query governance parameters.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const parameters = await namada.getStakingParameters()
    console.log({parameters})
    process.exit(0)
  })

  validatorList = this.command({
    name: 'validator-list',
    info: 'query all validator addresses',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const validatorAddresses = await namada.getValidatorAddresses()
    for (const validator of await namada.getValidatorAddresses()) {
      this.log.log(validator)
    }
    this.log.br().info('Total validators:', bold(String(validatorAddresses.length)))
    //for (const validator of await namada.getValidators({ prefix: 'tnam' })) {
      //this.log.br()
        ////.info('Validator:        ', bold(validator.address))
        //.info('Address (hex):    ', bold(validator.addressHex))
        //.info('Public key:       ', bold(validator.pubKeyHex))
        //.info('Voting power:     ', bold(String(validator.votingPower)))
        //.info('Proposer priority:', bold(String(validator.proposerPriority)))
    //}
    process.exit(0)
  })

  validatorSetConsensus = this.command({
    name: 'validators-consensus',
    info: 'query validators that participate in the consensus set',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    for (const {address, bondedStake} of await namada.getValidatorsConsensus()) {
      this.log.log(bold(address), bondedStake.toString())
    }
    process.exit(0)
  })

  validatorSetBelowCapacity = this.command({
    name: 'validators-below-capacity',
    info: 'query validators that are below capacity',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    for (const {address, bondedStake} of await namada.getValidatorsBelowCapacity()) {
      this.log.log(bold(address), bondedStake.toString())
    }
    process.exit(0)
  })

  validators = this.command({
    name: 'validators',
    info: 'query metadata for each consensus validator',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const validators = await namada.getValidators({ details: false })
    for (const i in validators) {
      const validator = validators[i]
      this.log.br()
      await validator.fetchDetails()
      this.log.br()
      this.log.printValidator(validator)
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
      this.log.error(bold('Pass a RPC URL, page number, and page size to query validators.'))
      process.exit(1)
    }
    if (page < 1) {
      this.log.error(bold('Pages start from 1.'))
      process.exit(1)
    }
    if (perPage < 1) {
      this.log.error(bold('Need to specify at least 1 result per page'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const allValidators = await namada.getValidators({ allStates: true, details: false })
    this.log.info(`Total validators: ${allValidators.length}`)
    const maxPage = Math.floor(allValidators.length / perPage) + 1
    if (page > maxPage) {
      this.log.error(`Max page: ${maxPage}`)
      process.exit(1)
    }
    this.log(`Querying info for validators from #${(page-1)*perPage+1} to #${page*perPage+1}...`)
    const details = await namada.getValidators({
      addresses: allValidators.map(validator=>validator.namadaAddress),
      allStates: true,
      pagination: [ page, perPage ],
      details: true
    })
    for (const validator of details) {
      this.log.br().printValidator(validator)
    }
    process.exit(0)
  })

  validator = this.command({
    name: 'validator',
    info: 'query info about a validator',
    args: 'RPC_URL ADDRESS'
  }, async (url: string, address: string) => {
    if (!url || !address) {
      this.log.error(bold('Pass a RPC URL and an address to query validator info.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const validator = await namada.getValidator(address)
    this.log.br().printValidator(validator).br()
    process.exit(0)
  })

  validatorStake = this.command({
    name: "validator-stake",
    info: "query staked amount by validator",
    args: "RPC_URL ADDRESS"
  }, async(url, address) => {
    const namada = await Namada.connect({ url })
    const stakedByAddress = await namada.getValidatorStake(address)
    this.log.log(stakedByAddress)
    process.exit(0)
  })

  governanceParameters = this.command({
    name: 'governance-parameters',
    info: 'query governance parameters',
    args: 'RPC_URL',
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query governance parameters.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const parameters = await namada.getGovernanceParameters()
    this.log
      .log()
      .log('Minimum proposal fund:         ', bold(parameters.minProposalFund))
      .log('Minimum proposal voting period:', bold(parameters.minProposalVotingPeriod))
      .log('Minimum proposal grace epochs: ', bold(parameters.minProposalGraceEpochs))
      .log()
      .log('Maximum proposal period:       ', bold(parameters.maxProposalPeriod))
      .log('Maximum proposal content size: ', bold(parameters.maxProposalContentSize))
      .log('Maximum proposal code size:    ', bold(parameters.maxProposalCodeSize))
      .log()
    process.exit(0)
  })

  proposalCount = this.command({
    name: 'proposal-count',
    info: 'query number of last proposal',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query proposal counter.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const counter = await namada.getProposalCount()
    this.log
      .log('Proposal count:', bold(String(counter)))
      .log('Last proposal: ', bold(String(counter-1n)))
      .info('Use the', bold('proposal'), 'command to query proposal details.')
    process.exit(0)
  })

  proposal = this.command({
    name: 'proposal',
    info: 'query info about a proposal by number',
    args: 'RPC_URL NUMBER'
  }, async (url: string, number: string) => {
    if (!url || !number || isNaN(Number(number))) {
      this.log.error(bold('Pass a RPC URL and proposal number to query proposal info.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const proposalInfo = await namada.getProposalInfo(Number(number))
    if (!proposalInfo) {
      this.log.error(`No proposal #${number}`)
      process.exit(1)
    }
    const {proposal, votes, result} = proposalInfo
    this.log
      .log()
      .log('Proposal:   ', bold(number))
      .log('Author:     ', bold(proposal.author))
      .log('Type:       ', bold(JSON.stringify(proposal.type)))
      .log('Start epoch:', bold(proposal.votingStartEpoch))
      .log('End epoch:  ', bold(proposal.votingEndEpoch))
      .log('Grace epoch:', bold(proposal.graceEpoch))
      .log()
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${bold(key)}:`)
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
        .log('Votes:       ', bold(votes.length))
        .log('Result:      ', bold(JSON.stringify(result.result)))
        .log('  Tally type:', bold(JSON.stringify(result.tallyType)))
        .log('  Yay:       ', bold(yayPercent),
           `of turnout`, `(${bold(totalYayPower)})`)
        .log('  Nay:       ', bold(nayPercent),
           `of turnout`, `(${bold(totalNayPower)})`)
        .log('  Abstain:   ', bold(abstainPercent),
           `of turnout`, `(${bold(totalAbstainPower)})`)
        .log('  Turnout:   ', bold(turnoutPercent),
           `of total voting power`, `(${bold(turnout)})`)
        .log('  Power:     ', bold(result.totalVotingPower))
        .log()
        .info('Use the', bold('proposal-votes'), 'command to see individual votes.')
    } else {
      this.log
        .log()
        .log(bold('There is no result for this proposal yet.'))
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
      this.log.error(bold('Pass a RPC URL and proposal number to query proposal votes.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    const proposalInfo = await namada.getProposalInfo(Number(number))
    if (!proposalInfo) {
      this.log.error(`No proposal #${number}`)
      process.exit(1)
    }
    const {proposal, votes, result} = proposalInfo
    this.log
      .log()
      .log('Proposal:   ', bold(number))
      .log('Author:     ', bold(JSON.stringify(proposal.author)))
      .log('Type:       ', bold(JSON.stringify(proposal.type)))
      .log('Start epoch:', bold(proposal.votingStartEpoch))
      .log('End epoch:  ', bold(proposal.votingEndEpoch))
      .log('Grace epoch:', bold(proposal.graceEpoch))
      .log()
      .log('Content:    ')
    for (const [key, value] of proposal.content.entries()) {
      this.log
        .log(`  ${bold(key)}:`)
        .log(`    ${value}`)
    }
    if (votes.length > 0) {
      for (const vote of votes) {
        this.log
          .log()
          .log(`Vote:`, bold(vote.data))
          .log(`  Validator:`, bold(vote.validator))
          .log(`  Delegator:`, bold(vote.delegator))
      }
      this.log.log()
    } else {
      this.log.log()
        .log(bold("There are no votes for this proposal yet."))
        .log()
    }
    process.exit(0)
  })

  block = this.command({
    name: 'block',
    info: 'try to fetch a block',
    args: 'RPC_URL [BLOCK]'
  }, async (url: string, height?: number) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    if (height !== undefined) {
      if (isNaN(Number(height))) {
        this.log.error(bold(`{height} is not a valid block height`))
        process.exit(1)
      }
      height = Number(height)
    }
    const namada = await Namada.connect({ url })
    const block = await namada.fetchBlock({ height: height! })
    this.log.log()
      .log('Block:', bold(block.height))
      .log('ID:   ', bold(block.id))
      .log('Time: ', bold(block.timestamp))
      .log(bold('Transactions:'))
    for (const tx of block.transactions) {
      this.log.log(tx)
    }
  })

  index = this.command({
    name: 'index',
    info: 'try to decode all transactions from latest block (or a given block) backwards',
    args: 'RPC_URL [BLOCK]'
  }, async (url: string, height?: number) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const namada = await Namada.connect({ url })
    let block
    do {
      block = await namada.fetchBlock({ height: Number(height) })
      height = block.height
      this.log.log()
        .log('Block:', bold(block.height))
        .log('ID:   ', bold(block.id))
        .log('Time: ', bold(block.timestamp))
        .log(bold('Transactions:'))
      for (const tx of block.transactions) {
        this.log.log(tx)
      }
      height--
    } while (height > 0)
  })
}
