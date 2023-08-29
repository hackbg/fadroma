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

import {
  Console, Error, Chain, ChainMode, ChainId, Mocknet, bold, randomChainId
} from '@fadroma/agent'
import type { Agent, ChainRegistry } from '@fadroma/agent'
import * as Scrt from '@fadroma/scrt'
export * from '@fadroma/cw'

import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'

// Populate `Chain.variants` with catalog of possible connections:
Object.assign(Chain.variants as ChainRegistry, {
  // Support for Secret Network
  ScrtMainnet: Scrt.Chain.mainnet,
  ScrtTestnet: Scrt.Chain.testnet,
  // Devnet is injected here by @hackbg/fadroma
})

export * from '@hackbg/conf'

export * from '@fadroma/agent'

export { Scrt, Mocknet }

export default function connect <A extends Agent> (
  config: Partial<ConnectConfig> = new ConnectConfig()
): A {
  return new ConnectConfig(config).getAgent()
}

/** Connection configuration. Factory for `Chain` and `Agent` objects. */
export class ConnectConfig extends Config {
  constructor (
    options: Partial<ConnectConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
    Object.defineProperty(this, 'mnemonic', { enumerable: false, writable: true })
    this.scrt = new Scrt.Config(options?.scrt, environment)
    this.chainId = this.getString('FADROMA_CHAIN_ID', ()=>{
      const chainIds = {
        Mocknet:     'mocknet',
        ScrtDevnet:  'fadroma-devnet',
        ScrtTestnet: this.scrt.testnetChainId,
        ScrtMainnet: this.scrt.mainnetChainId,
      }
      return chainIds[this.chain as keyof typeof chainIds]
    })
  }
  /** Logger handle. */
  log = new ConnectConsole('@fadroma/connect')
  /** Secret Network configuration. */
  scrt: Scrt.Config
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName: string
    = this.getString('FADROMA_AGENT', ()=>'Admin')
  /** Name of chain to use. */
  chain?: keyof ChainRegistry = this.getString('FADROMA_CHAIN',
    ()=>'Mocknet')
  /** Override chain id. */
  chainId?: ChainId
  /** Override chain mode. */
  chainMode: ChainMode = this.getString('FADROMA_CHAIN_MODE', () => {
    const chainModes = {
      Mocknet:     ChainMode.Mocknet,
      ScrtDevnet:  ChainMode.Devnet,
      ScrtTestnet: ChainMode.Testnet,
      ScrtMainnet: ChainMode.Mainnet,
    }
    if (!this.chain) throw new ConnectError.NoChainSelected(chainModes)
    const result = chainModes[this.chain as keyof typeof chainModes]
    if (!result) throw new ConnectError.UnknownChainSelected(this.chain, chainModes)
    return result
  }) as ChainMode
  /** Mnemonic to use for authentication to testnet. */
  testnetMnemonic?: string
    = this.getString('FADROMA_TESTNET_MNEMONIC', ()=>undefined)
  /** Mnemonic to use for authentication. Hidden from logs by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC', ()=>undefined)
  /** Create the Chain instance specified by the configuration. */
  getChain <C extends Chain> (
    getChain: keyof ChainRegistry|ChainRegistry[keyof ChainRegistry]|undefined = this.chain
  ): C {
    if (!getChain) {
      getChain = this.chain
      if (!getChain) throw new Error.Missing.Chain()
    }
    if (typeof getChain === 'string') { // allow name to be passed
      getChain = Chain.variants[getChain]
    }
    if (!getChain) { // if still unspecified, throw
      throw new ConnectError.UnknownChainSelected(this.chain!, Chain.variants)
    }
    return getChain({ config: this }) as C // create Chain object
  }
  /** Create the Agent instance identified by the configuration. */
  getAgent <A extends Agent> (options: Partial<A> = {}): A {
    options.chain ??= this.getChain()
    options.name ??= this.agentName
    if (this.chainMode === ChainMode.Testnet) {
      options.mnemonic ??= this.testnetMnemonic
    } else {
      options.mnemonic ??= this.mnemonic
    }
    return options.chain.getAgent(options) as A
  }
  /** List all known chains. */
  listChains () {
    this.log.supportedChains()
    this.log.selectedChain(this.chain as string)
  }
}

export class ConnectConsole extends Console {
  label = 'Fadroma Connect'

  supportedChains (supportedChains: Record<string, unknown> = Chain.variants) {
    this.br()
    this.info('Known chain names:')
    for (const chain of Object.keys(supportedChains).sort()) {
      this.info(`  ${bold(chain)}`)
    }
  }

  selectedChain (chain?: string) {
    this.br()
    if (chain) {
      this.info('Selected chain:')
      this.info(`  ${bold(chain)}`)
    } else {
      this.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
    this.br()
  }
}

export class ConnectError extends Error {
  static SelectChainHint =
    `Try setting the FADROMA_CHAIN env var to one of the supported values.`
  static UnknownChainSelected = this.define('UnknownChainSelected',
    (name: string, chains?: Record<string, unknown>)=>{
      //chains && log.supportedChains(chains)
      return `Unknown chain "${name}". ${this.SelectChainHint}`
    })
  static NoChainSelected = this.define('NoChainSelected',
    (chains?: Record<string, unknown>)=>{
      //chains && log.supportedChains(chains)
      return `No chain selected. ${this.SelectChainHint}`
    })
}
