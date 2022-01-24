import {
  Console, bold, open, table, noBorders,
  resolve, Directory, JSONDirectory,
  IChain, IChainNode, IChainState, IChainConnectOptions,
  BaseChain, DeploymentsDir, prefund,
  Identity, IAgent
} from '@fadroma/ops'

import { URL } from 'url'
import { ScrtCLIAgent } from './ScrtAgentCLI'
import { resetLocalnet } from './ScrtChainNode'

const console = Console('@fadroma/scrt/ScrtChainAPI')

export class Scrt extends BaseChain {

  //chainId = 'supernova-1'
  //apiURL  = new URL('http://localhost:1337')
  faucet  = `https://faucet.secrettestnet.io/`

  /** create agent operating on the current instance's endpoint*/
  async getAgent (
    identity: string|Identity = this.defaultIdentity
  ): Promise<IAgent> {

    if (typeof identity === 'string') {
      identity = this.node.genesisAccount(identity)
    }

    const { mnemonic, keyPair } = identity as Identity
    if (mnemonic || keyPair) {
      return await this.Agent.create({ ...identity, chain: this as Chain })
    } else {
      const name = identity.name || this.defaultIdentity?.name
      if (name) {
        console.info(`Using a ${bold('secretcli')}-based agent.`)
        return new ScrtCLIAgent({ chain: this, name }) as Agent
      } else throw new Error(
        'You need to provide a name to get a secretcli-backed agent, ' +
        'or a mnemonic or keypair to get a SecretJS-backed agent.'
      )
    }

  }
}
