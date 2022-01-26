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
  deployment?: Deployment,
  prefix?:     string,
  cmdArgs:     string[]
  run (command: Function, args?: object): Promise<any>
}
export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>
import { init, timestamp, Console, bold } from '@fadroma/ops'
const console = Console('@hackbg/fadroma')
export class Fadroma {

  module (url: string): Commands {
    // if main
    if (process.argv[1] === fileURLToPath(url)) {
      Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
      runCommands.default(this.commands, process.argv.slice(2))
    }
    // if imported
    return this.commands
  }

  chains = CHAINS

  chainId = process.env.FADROMA_CHAIN

  /** Establish correspondence between an input command
    * and a series of procedures to execute */
  command (name: string, ...stages: Command<any>[]) {
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
        commands[fragments[i]] = (args: string[]) => this.runCommand(name, stages, args)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  /** Tree of command. */
  commands: Commands = {}

  // Is this a monad?
  private async runCommand (name: string, stages: Command<any>[], cmdArgs?: string[]): Promise<any> {
    requireChainId(this.chainId)
    const { chain, admin } = await init(this.chains, this.chainId)
    const deployment = getActiveDeployment(chain)
    let context: MigrationContext = {
      chain,
      admin,
      ...getActiveDeployment(chain),
      timestamp: timestamp(),
      cmdArgs,
      // Run a sub-procedure in the same context,
      // but without mutating the context.
      async run (command: Function, args: Record<string, any> = {}): Promise<any> {
        return command({ ...context, ...args })
      },
    }
    // Composition of commands via stages:
    for (const stage of stages) {
      name = stage.name || name
      if (name) {
        console.info(bold('Running:'), name)
      } else {
        console.warn(bold('Running nameless command. Please define commands as named functions.'))
      }
      // Every stage refreshes the context
      // by adding its outputs to it.
      context = { ...context, ...await stage({ ...context }) }
    }
    return context
  }

}

function requireChainId (id: any) {
  if (!id) {
    console.log('Please set your FADROMA_CHAIN environment variable to one of the following:')
    console.log('  '+Object.keys(this.chains).sort().join('\n  '))
    // TODO if interactive, display a selector which exports it for the session
    process.exit(1)
  }
}

function getActiveDeployment (chain: IChain): {
  deployment: Deployment|undefined,
  prefix:     string|undefined
} {
  const deployment = chain.deployments.active
  const prefix     = deployment?.prefix
  if (deployment) {
    console.info(bold('Active deployment:'), deployment.prefix)
    const contracts = Object.values(deployment.contracts).length
    if (contracts === 0) {
      console.info(bold('This is a clean deployment.'))
    } else {
      console.info(bold('This deployment contains'), contracts, 'contracts')
      for (const contract of Object.keys(deployment.contracts)) {
        console.info(bold('Found contract'), contract)
      }
    }
  }
  return {
    deployment,
    prefix
  }
}

export default new Fadroma()
