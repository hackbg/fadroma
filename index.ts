export * from '@fadroma/ops'

import type { IChainConnectOptions } from '@fadroma/ops'
export type Chains = Record<string, (options: IChainConnectOptions)=>IChain>
export const CHAINS: Chains = {}

import Scrt_1_0 from '@fadroma/scrt-1.0'
Object.assign(CHAINS, Scrt_1_0.Chains)
export { Scrt_1_0 }

import Scrt_1_2 from '@fadroma/scrt-1.2'
Object.assign(CHAINS, Scrt_1_2.Chains)
export { Scrt_1_2 }

import { fileURLToPath } from 'url'
import runCommands from '@hackbg/komandi'
import type { IChain, IAgent, Deployment } from '@fadroma/ops'
export type MigrationContext = {
  timestamp:   string
  chain:       IChain
  admin:       IAgent
  deployment?: Deployment
}
export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>
import { init, timestamp } from '@fadroma/ops'
export class Fadroma {

  chains = CHAINS

  chainId = process.env.FADROMA_CHAIN

  commands: Commands = {}

  command <T> (name: string, command: Command<T>) {
    const fragments = name.trim().split(' ')
    let commands: any = this.commands
    for (let i = 0; i < fragments.length; i++) {
      commands[fragments[i]] = commands[fragments[i]] || {}
      // prevent overrides
      if (commands instanceof Function) {
        throw new Error('[@fadroma] command already exists')
      }
      // descend or reach bottom
      if (i === fragments.length-1) {
        commands[fragments[i]] = (args: string[]) => this.run(command, args)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  async run <T> (command: Command<T>, args?: string[]): Promise<T> {
    if (!this.chainId) {
      console.log('Please set your FADROMA_CHAIN environment variable to one of the following:')
      console.log('  '+Object.keys(this.chains).sort().join('\n  '))
      // TODO if interactive, display a selector which exports it for the session
      process.exit(1)
    }
    const { chain, admin } = await init(this.chains, this.chainId)
    return await command({
      timestamp: timestamp(),
      chain,
      admin,
      deployment: chain.deployments.active,
      args
    })
  }

  module (url: string): Commands {
    // if main
    if (process.argv[1] === fileURLToPath(url)) {
      Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
      runCommands.default(this.commands, process.argv.slice(2))
    }
    // if imported
    return this.commands
  }

}

export default new Fadroma()
