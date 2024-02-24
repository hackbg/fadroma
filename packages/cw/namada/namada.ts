import { CLI } from '../cw-base'
import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
import { brailleDump } from '@hackbg/dump'
import * as Borsh from 'borsh'
import Borshes from './namada-borsh'
import Addresses from './namada-address'

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
    const { metadata, state } = await connection.getValidatorMetadata(address)
    console.log({state})
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
    const proposal = await connection.getProposalInfo(Number(number))
    this.log
      .log('Proposal:', Core.bold(number))
      .log(proposal)
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

type Proposal = {
  id:                 string,
  proposal_type:      "pgf_steward" | "pgf_payment" | "default";
  author:             string,
  start_epoch:        bigint,
  end_epoch:          bigint,
  grace_epoch:        bigint,
  content_json:       string,
  status:             "ongoing" | "finished" | "upcoming"
  result:             "passed" | "rejected"
  total_voting_power: string,
  total_yay_power:    string,
  total_nay_power:    string,
}

async function abciQuery (client, path, params = new Uint8Array) {
  const { value } = await client.queryAbci(path, params)
  return value
}

class NamadaConnection extends CWConnection {

  async getValidatorMetadata (address: Address): Promise<{
    metadata: ValidatorMetaData
    state: any
  }> {
    const client = await this.qClient
    const [
      metadata,
      /*commission,*/
      state,
    ] = await Promise.all([
      `/vp/pos/validator/metadata/${address}`,
      //`/vp/pos/validator/commission/${address}`, // TODO
      `/vp/pos/validator/state/${address}`,
    ].map(path => abciQuery(client, path)))
    return {
      metadata: Borsh.deserialize(Borshes.ValidatorMetaData, metadata) as ValidatorMetaData,
      state: Borsh.deserialize(Borshes.ValidatorState, state) as any
      //commission: Borsh.deserialize(Borshes.CommissionPair, commission),
    }
  }

  async getProposalCount () {
    const client = await this.qClient
    const counter = await abciQuery(client, `/shell/value/#${Addresses.Governance}/counter`)
    return Borsh.deserialize('u64', counter) as bigint
  }

  async getProposalInfo (number: Number) {
    const client = await this.qClient
    const info = await abciQuery(client, `/vp/governance/proposal/${number}`)
    console.log({info})
    return Borsh.deserialize(Borshes.Proposal, info)
  }

}

class NamadaMnemonicIdentity extends CWMnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<CWMnemonicIdentity>) {
    super({ ...defaults, ...properties||{} })
  }
}

const defaults = { coinType: 118, bech32Prefix: 'tnam', hdAccountIndex: 0, }

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
