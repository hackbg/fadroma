import { CLI } from '../cw-base'
import { Core } from '@fadroma/agent'
import { CWConnection, CWBatch } from '../cw-connection'
import { CWMnemonicIdentity } from '../cw-identity'

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
    const connection = new CWConnection({ url })
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
}

class NamadaConnection extends CWConnection {}

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
