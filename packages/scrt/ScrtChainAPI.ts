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

  chainId = 'supernova-1'
  apiURL  = new URL('http://localhost:1337')
  faucet  = `https://faucet.secrettestnet.io/`

  #ready: Promise<any>|null = null
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#init()
  }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async #init (): Promise<IChain> {

    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node)

    if (node) {
      this.node = node

      // respawn that container
      console.info(`Running on localnet ${bold(this.chainId)} @ ${bold(this.stateRoot.path)}`)
      await node.respawn()
      await node.ready

      // set the correct port to connect to
      this.apiURL.port = String(node.port)
      console.info(`Localnet ready @ port ${bold(this.apiURL.port)}`)

      // get the default account for the node
      if (typeof this.defaultIdentity === 'string') {
        try {
          this.defaultIdentity = this.node.genesisAccount(this.defaultIdentity)
        } catch (e) {
          console.warn(`Could not load default identity ${this.defaultIdentity}: ${e.message}`)
        }
      }

    }

    const { protocol, hostname, port } = this.apiURL

    console.info(`Connecting to ${this.chainId} via ${protocol} on ${hostname}:${port}`)

    if (this.defaultIdentity) {
      // default credentials will be used as-is unless using localnet
      const { mnemonic, address } = this.defaultIdentity
      this.defaultIdentity = await this.getAgent({ name: "ADMIN", mnemonic, address })
      console.info(`Operating as ${address}`)
    }

    return this as IChain

  }

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
