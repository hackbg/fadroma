/**
  Fadroma Connect
  Copyright (C) 2023 Hack.bg

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

import { Console, Error, Agent, Mode, ChainId, bold } from '@fadroma/agent'
import * as Scrt from '@fadroma/scrt'
import * as CW from '@fadroma/cw'

import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'

export * from '@hackbg/conf'
export * from '@fadroma/agent'

export { Scrt, CW }

export type ConnectMode =
  |`Scrt${'Mocknet'|'Devnet'|'Testnet'|'Mainnet'}`
  |`OKP4${'Devnet'|'Testnet'}`

export const connectModes = {
  // Support for Secret Network
  ScrtMainnet: Scrt.mainnet,
  ScrtTestnet: Scrt.testnet,
  ScrtDevnet: (...args: Parameters<typeof Scrt.Agent.devnet>): Scrt.Agent => {
    throw new Error('Devnets are only available through @hackbg/fadroma')
  },
  ScrtMocknet: Scrt.mocknet,

  // Support for OKP4:
  OKP4Testnet: CW.OKP4.testnet,
  OKP4Devnet: (...args: Parameters<typeof CW.OKP4.Agent.devnet>): CW.OKP4.Agent => {
    throw new Error('Devnets are only available through @hackbg/fadroma')
  },

  // TODO: Support for custom chain
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
    this.okp4 = new CW.OKP4.Config(options?.okp4, environment)
    this.chainId = this.getString('FADROMA_CHAIN_ID', ()=>this.getChainId())
  }

  protected getChainId () {
    const chainIds: Record<ConnectMode, ChainId> = {
      ScrtDevnet:  'fadroma-devnet',
      ScrtTestnet: this.scrt.testnetChainId,
      ScrtMainnet: this.scrt.mainnetChainId,
      ScrtMocknet: 'mocknet',
      OKP4Devnet:  'fadroma-devnet-okp4',
      OKP4Testnet: this.okp4.testnetChainId,
    }
    return chainIds[this.chain as keyof typeof chainIds]
  }

  protected getMode () {
    const chainModes: Record<ConnectMode, Mode> = {
      ScrtDevnet:  Mode.Devnet,
      ScrtTestnet: Mode.Testnet,
      ScrtMainnet: Mode.Mainnet,
      ScrtMocknet: Mode.Mocknet,
      OKP4Devnet:  Mode.Devnet,
      OKP4Testnet: Mode.Testnet,
    }
    if (!this.chain) {
      throw new Error('no chain selected')
    }
    const result = chainModes[this.chain as keyof typeof chainModes]
    if (!result) {
      throw new Error(`unknown chain '${name}'`)
    }
    return result
  }

  /** Logger handle. */
  log = new Console('@fadroma/connect')
  /** Secret Network configuration. */
  scrt: Scrt.Config
  /** Secret Network configuration. */
  okp4: CW.OKP4.Config
  /** Name of stored mnemonic to use for authentication (currently devnet only) */
  agentName: string = this.getString('FADROMA_AGENT', ()=>'Admin')
  /** Name of chain to use. */
  chain?: ConnectMode = this.getString('FADROMA_CHAIN', ()=>'ScrtMocknet')
  /** Override chain id. */
  chainId?: ChainId
  /** Override chain mode. */
  chainMode: Mode = this.getString('FADROMA_CHAIN_MODE', () => this.getMode())
  /** Mnemonic to use for authentication to testnet. */
  testnetMnemonic?: string
    = this.getString('FADROMA_TESTNET_MNEMONIC', ()=>undefined)
  /** Mnemonic to use for authentication. Hidden from logs by default. */
  mnemonic?: string
    = this.getString('FADROMA_MNEMONIC', ()=>undefined)
  /** List all known chains. */
  listChains () {
    this.log.br()
    this.log.info('Known chain names:')
    for (const chain of Object.keys(connectModes).sort()) {
      this.log.info(`  ${bold(chain)}`)
    }
    this.log.br()
    if (this.chain) {
      this.log.info('Selected chain:')
      this.log.info(`  ${bold(this.chain)}`)
    } else {
      this.log.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
    this.log.br()
  }
}
