/**

  Fadroma
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

import * as Konfizi   from '@hackbg/konfizi'
import * as Komandi   from '@hackbg/komandi'
import * as Konzola   from '@hackbg/konzola'

import * as Fadroma   from '@fadroma/client'
import * as Build     from '@fadroma/build'
import * as Connect   from '@fadroma/connect'
import * as Deploy    from '@fadroma/deploy'
import * as Devnet    from '@fadroma/devnet'

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Fadroma.Chain|Promise<Fadroma.Chain>>

/** Complete environment configuration of all Fadroma subsystems. */
export class Config extends Konfizi.EnvConfig {
  /** Path to root of project. Defaults to current working directory. */
  project: string
    = this.getString('FADROMA_PROJECT', ()=>this.cwd)
  build
    = new Build.BuilderConfig(this.env, this.cwd)
  connect
    = new Connect.ConnectConfig(this.env, this.cwd)
  deploy
    = new Deploy.DeployConfig(this.env, this.cwd)
  devnet
    = new Devnet.DevnetConfig(this.env, this.cwd)
  scrtGrpc
    = new Connect.ScrtGrpc.Config(this.env, this.cwd)
  scrtAmino
    = new Connect.ScrtAmino.Config(this.env, this.cwd)
}

/** Context for Fadroma commands. */
export class Context extends Komandi.Context {
  config  = new Config(this.env, this.cwd)
  project = this.config.project
  build   = new Build.BuildContext(this.config.build, project)
  connect = new Connect.ConnectContext(this.config.connect)
  deploy  = new Deploy.DeployContext(this.config.deploy, this.connect, this.build)
  constructor (
    config: Config,
    /** The selected blockhain to connect to. */
    public chain?: Fadroma.Chain,
    /** The selected agent to operate as. */
    public agent?: Fadroma.Agent
  ) {
    super()
  }

  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean { return this.chain?.devMode ?? false }

  /** = chain.isMainnet */
  get isMainnet (): boolean { return this.chain?.isMainnet ?? false }

  /** = chain.isTestnet */
  get isTestnet (): boolean { return this.chain?.isTestnet ?? false }

  /** = chain.isDevnet */
  get isDevnet  (): boolean { return this.chain?.isDevnet ?? false }

  /** = chain.isMocknet */
  get isMocknet (): boolean { return this.chain?.isMocknet ?? false }
}

export async function connect (

  config: Config
    = new Config(proce),

  chain:  Fadroma.Chain|keyof ChainRegistry|null
    = config.chain as keyof ChainRegistry,

  agent?: Fadroma.Agent|Fadroma.AgentOpts|string

): Promise<Context> {

  const log = new ConnectConsole(console, 'Fadroma.connect')

  if (!chain) {
    process.exit(log.noName(chains))
  }

  if (typeof chain === 'string') {
    if (!chains[chain]) {
      process.exit(log.noName(chains))
    }
    chain = await Promise.resolve(chains[chain](config))
  }

  if (typeof agent === 'string') {
    if (chain.isDevnet) {
      agent = { name: agent }
    } else {
      throw new Error('agent from string is only supported for devnet genesis accounts')
    }
  } else if (agent && !(agent instanceof Fadroma.Agent)) {
    agent.mnemonic = config.agentMnemonic
  }

  return new Context(config, chain, await chain.getAgent(agent))

}

export * from '@hackbg/konzola'
export * from '@hackbg/komandi'
export * from '@hackbg/konfizi'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'

export * from '@fadroma/client'
export type { Decimal } from '@fadroma/client'
export * from '@fadroma/build'
export * from '@fadroma/deploy'
export * from '@fadroma/devnet'
export * from '@fadroma/connect'
export * from '@fadroma/mocknet'
export * from '@fadroma/tokens'
export * as ScrtGrpc  from '@fadroma/scrt'
export * as ScrtAmino from '@fadroma/scrt-amino'
