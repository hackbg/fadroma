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
    for (const {address, bondedStake} of await connection.getConsensusValidators()) {
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
    for (const {address, bondedStake} of await connection.getBelowCapacityValidators()) {
      this.log.log(Core.bold(address), bondedStake.toString())
    }
    process.exit(0)
  })

  validators = this.command({
    name: 'validators',
    info: 'query metadata for each validator',
    args: 'RPC_URL'
  }, async (url: string) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to query validators.'))
      process.exit(1)
    }
    const connection = new NamadaConnection({ url })
    const validatorList = await connection.getValidators()
    console.log({validatorList})
    process.exit(123)
    const [ validatorAddresses, baseMetadata ] = await Promise.all([
      connection.getValidatorAddresses(),
      connection.getValidators()
    ])
    this.log.br()
    const validators = baseMetadata.reduce((a,x)=>Object.assign(a, { [x.addressHex]: x }), {})
    for (const key in validators) {
      console.log(key, await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${key}`))
    }
    const addresses = await connection.getValidatorAddresses()
    for (const i in addresses) {
      const address = addresses[i]
      this.log.info(`(${Number(i)+1}/${addresses.length})`)
      const {
        metadata, commission, state, stake, consensusKey
      } = await connection.getValidator(address)
      this.log
        .log('Validator:    ', Core.bold(address))
        .log('State:        ', Core.bold(Object.keys(state)[0]))
        .log('Stake:        ', Core.bold(stake))
        .log('Commission:   ', Core.bold(commission.commissionRate))
        .log('  Max change: ', Core.bold(commission.maxCommissionChangePerEpoch), 'per epoch')
        .log('Email:        ', Core.bold(metadata.email||''))
        .log('Website:      ', Core.bold(metadata.website||''))
        .log('Discord:      ', Core.bold(metadata.discordHandle||''))
        .log('Avatar:       ', Core.bold(metadata.avatar||''))
        .log('Description:  ', Core.bold(metadata.description||''))
      const keyType = Object.keys(consensusKey)[0]
      const keyValue = new Uint8Array(consensusKey[keyType])
      const consensusAddress = Core.base16.encode(Core.SHA256(keyValue).slice(0, 20))
      this.log
        .log('Consensus pubkey: ', Core.bold('('+keyType+')'), Core.bold(Core.base16.encode(keyValue)))
        .log('Consensus address:', Core.bold(consensusAddress), validators[consensusAddress], validators)
        .br()
    }
    this.log
      .br()
      .info('Total validators:', Core.bold(String(validatorAddresses.length)))
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
    const { metadata, commission, state } = await connection.getValidator(address)
    this.log.br()
      .log('Address:     ', Core.bold(address))
      .log('State:       ', Core.bold(Object.keys(state)[0]))
      .log('Commission:  ', Core.bold(commission.commissionRate))
      .log('Max change:  ', Core.bold(commission.maxCommissionChangePerEpoch), 'per epoch')
      .log('Email:       ', Core.bold(metadata.email))
    if (metadata.website) {
      this.log('Website:     ', Core.bold(metadata.website))
    }
    if (metadata.discordHandle) {
      this.log('Discord:     ', Core.bold(metadata.discordHandle))
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

  stakedByValidator = this.command({
    name: "staked-by-validator",
    info: "Show staked amount by validator",
    args: "RPC_URL ADDRESS"
  }, async(url, address) => {
    const connection = new NamadaConnection({ url })
    const stakedByAddress = await connection.getValidatorStake(address)
    this.log.log(stakedByAddress)
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
