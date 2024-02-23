import { CLI } from '../cw-base'
import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'
import { brailleDump } from '@hackbg/dump'
import * as Borsh from 'borsh'

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
}

type ValidatorMetaData = {
  email: string,
  description: string|null,
  website: string|null,
  discord_handle: string|null,
  avatar: string|null
}

class NamadaConnection extends CWConnection {

  async getValidatorMetadata (address: Address): Promise<{
    metadata: ValidatorMetaData
  }> {
    const client = await this.qClient
    const [metadata, /*commission*/] = await Promise.all([
      `/vp/pos/validator/metadata/${address}`,
      //`/vp/pos/validator/commission/${address}`, // TODO
    ].map(
      async path => (await client.queryAbci(path, new Uint8Array())).value
    ))
    return {
      metadata: Borsh.deserialize(Borshes.ValidatorMetaData, metadata) as ValidatorMetaData,
      //commission: Borsh.deserialize(Borshes.CommissionPair, commission),
    }
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

/** Borsh schema for values returned by ABCI. */
export const Borshes = {
  ValidatorMetaData: {
    option: {
      struct: {
        email: 'string',
        description: { option: 'string' },
        website: { option: 'string' },
        discord_handle: { option: 'string' },
        avatar: { option: 'string' }
      }
    }
  },
  //CommissionPair: {
    //option: {
      //struct: {
        //commission_rate: 'string',
        //max_commission_change_per_epoch: 'string',
      //}
    //}
  //}
}
