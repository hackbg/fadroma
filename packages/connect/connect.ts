/*
  Fadroma Cross-Chain Connector
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import { Env, EnvConfig } from '@hackbg/conf'
import { CommandContext } from '@hackbg/cmds'
import {
  Agent,
  AgentOpts,
  Chain,
  ChainId,
  ChainMode,
  ChainRegistry,
  Class,
  Deployment,
  bold
} from '@fadroma/core'
import { Devnet, DevnetConfig, DockerDevnet, defineDevnet } from '@fadroma/devnet'
import { Scrt } from '@fadroma/scrt'
import { Mocknet_CW0, Mocknet_CW1 } from '@fadroma/mocknet'
import { ConnectConsole as Console, ConnectError as Error } from './connect-events'

/** Populate `Fadroma.Chain.variants` with catalog of possible connections. */
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Mocknet
  async Mocknet_CW0 (config: unknown): Promise<Mocknet_CW0> { return new Mocknet_CW0() },
  async Mocknet_CW1 (config: unknown): Promise<Mocknet_CW1> { return new Mocknet_CW1() },
  // Support for Secret Network
  ScrtMainnet: Scrt.Mainnet,
  ScrtTestnet: Scrt.Testnet,
  ScrtDevnet:  defineDevnet(Scrt, 'scrt_1.7'),
})

export * from './connect-events'
export * as Scrt from '@fadroma/scrt'
export * as Mocknet from '@fadroma/mocknet'
export * as Devnet from '@fadroma/devnet'

export async function connect (
  config: Partial<ConnectConfig> = new ConnectConfig()
): Promise<Connector> {
  return await new ConnectConfig(config).getConnector()
}

export class ConnectCommands extends CommandContext {
  constructor (readonly connector: Connector) {
    super('@fadroma/connect')
    this.addCommand(
      'list',
      'print a list of all known chains',
      connector.listChains.bind(connector)
    )
    if (connector.chain?.node instanceof DockerDevnet) {
      this.addCommand(
        'export',
        'export the current devnet as a new Docker image',
        (...args) => (connector.chain?.node as unknown as DockerDevnet).export(...args)
      )
    }
  }
}

/** Constructor for a subclass of Connector that
  * maintains the original constructor signature. */
export interface ConnectorClass<C extends Connector> extends Class<C, [
  Partial<Connector>
]>{}

/** A Deployment with associated Agent and awareness of other chains. */
export class Connector extends Deployment {

  constructor (options: Partial<Connector> = { config: new ConnectConfig() }) {
    super(options as Partial<Deployment>)
    this.config = new ConnectConfig(options?.config, this.env, this.cwd)
    this.addCommands(
      'chain',
      'manage chains' + (
        this.config.chainSelector ? ` (current: ${bold(this.config.chainSelector)})` : ''
      ),
      new ConnectCommands(this) as CommandContext
    )
  }

  /** Logger */
  log = new Console('@fadroma/connect')

  /** Configuration. */
  config: ConnectConfig

  /** List all known chains. */
  async listChains () {
    this.log.supportedChains()
    this.log.selectedChain(this.config.chainSelector as string)
  }

}

/** Connection configuration and Connector factory.
  * Factory pattern and consequent inversion of control
  * here imposed by the lack of `await new` */
export class ConnectConfig extends EnvConfig {

  constructor (
    defaults: Partial<ConnectConfig> = {},
    readonly env: Env    = {},
    readonly cwd: string = '',
  ) {
    super(env, cwd)
    this.override(defaults)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
  }

  /** Name of chain to use. */
  chainSelector?: keyof ChainRegistry = this.getString('FADROMA_CHAIN', ()=>undefined)

  /** Get a chain ID corresponding to the value of `this.chain`.
    * (Used by subclasses to include chain ID in paths.) */
  get chainId (): ChainId {
    const chainIds = {
      Mocknet_CW0: 'mocknet-cw0',
      Mocknet_CW1: 'mocknet-cw1',
      ScrtDevnet:   'fadroma-devnet',
      ScrtTestnet:  Scrt.defaultTestnetChainId,
      ScrtMainnet:  Scrt.defaultMainnetChainId,
    }
    if (!this.chainSelector) throw new Error.NoChainSelected(chainIds)
    const result = chainIds[this.chainSelector as keyof typeof chainIds]
    if (!result) throw new Error.UnknownChainSelected(this.chainSelector, chainIds)
    return result
  }

  /** Get a chain mode corresponding to the value of `this.chain`.
    * (Used by settings to dispatch on chain mode.) */
  get chainMode (): ChainMode {
    const chainModes = {
      Mocknet_CW0: ChainMode.Mocknet,
      Mocknet_CW1: ChainMode.Mocknet,
      ScrtDevnet:  ChainMode.Devnet,
      ScrtTestnet: ChainMode.Testnet,
      ScrtMainnet: ChainMode.Mainnet,
    }
    if (!this.chainSelector) throw new Error.NoChainSelected(chainModes)
    const result = chainModes[this.chainSelector as keyof typeof chainModes]
    if (!result) throw new Error.UnknownChainSelected(this.chainSelector, chainModes)
    return result
  }

  /** Secret Network configuration. */
  scrt = new Scrt.Config(this.env, this.cwd)

  /** Devnets configuration. */
  devnet = new DevnetConfig(this.env, this.cwd)

  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  devnetAgentName: string
    = this.getString('FADROMA_AGENT',   ()=>
      this.getString('SCRT_AGENT_NAME', ()=> 'ADMIN'))

  /** Mnemonic to use for authentication. Hidden by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC',    ()=>
      this.getString('SCRT_AGENT_MNEMONIC', ()=> undefined))

  // Create the Chain instance specified by the configuration.
  async getChain <C extends Chain> (
    getChain: keyof ChainRegistry|ChainRegistry[keyof ChainRegistry]|undefined = this.chainSelector
  ): Promise<C> {

    if (!getChain) {
      getChain = this.chainSelector
      if (!getChain) throw new Error.NoChain()
    }

    if (typeof getChain === 'string') { // allow name to be passed
      getChain = Chain.variants[getChain]
    }

    if (!getChain) { // if still unspecified, throw
      throw new Error.UnknownChainSelected(this.chainSelector!, Chain.variants)
    }

    return await Promise.resolve(getChain(this)) as C // create Chain object

  }

  async getAgent <A extends Agent> (chain?: Chain): Promise<A> {
    chain ??= await this.getChain()
    // Create the Agent instance as identified by the configuration.
    let agentOpts: AgentOpts = { chain }
    if (chain.isDevnet) {
      // On devnet, agent can be created from genesis account
      agentOpts.name = this.devnetAgentName
    } else {
      // Otherwise it's created from mnemonic
      agentOpts.mnemonic = this.mnemonic
    }
    return await chain.getAgent(agentOpts) as A
  }

  /** Create a `Connector` containing instances of `Chain` and `Agent`
    * as specified by the configuration and return a `Connector with them. */
  async getConnector <C extends Connector> ($C?: ConnectorClass<C>): Promise<C> {
    $C ??= Connector as ConnectorClass<C>
    // Create chain and agent
    const chain = await this.getChain()
    const agent = await this.getAgent(chain)
    if (agent.chain !== chain) throw new Error('Bug: agent.chain propagated incorrectly')
    // Create the Connector holding both and exposing them to commands.
    return new $C({ chain, agent, config: this }) as C
  }

}

