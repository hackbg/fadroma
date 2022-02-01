export * from '@fadroma/ops'

import type { ChainConnectOptions } from '@fadroma/ops'
export type Chains = Record<string, (options: ChainConnectOptions)=>Chain>
export const CHAINS: Chains = {}

import Scrt_1_0 from '@fadroma/scrt-1.0'
Object.assign(CHAINS, Scrt_1_0.Chains)
export { Scrt_1_0 }

import Scrt_1_2 from '@fadroma/scrt-1.2'
Object.assign(CHAINS, Scrt_1_2.Chains)
export { Scrt_1_2 }

import { fileURLToPath } from 'url'
import runCommands from '@hackbg/komandi'
import type { Chain, Agent, Deployment } from '@fadroma/ops'
export type MigrationContext = {
  timestamp:   string
  chain:       Chain
  admin:       Agent
  deployment?: Deployment,
  prefix?:     string,
  cmdArgs:     string[]
  run (command: Function, args?: object): Promise<any>
}
export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>
import { init, timestamp, Console, bold, colors } from '@fadroma/ops'
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
  command (name: string, ...steps: Command<any>[]) {
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
        commands[fragments[i]] = (...cmdArgs: string[]) => this.runCommand(name, steps, cmdArgs)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  /** Tree of command. */
  commands: Commands = {}

  // Is this a monad?
  private async runCommand (commandName: string, steps: Command<any>[], cmdArgs?: string[]): Promise<any> {
    console.log('runCommand', {cmdArgs})
    requireChainId(this.chainId, this.chains)
    const { chain, admin } = await init(this.chains, this.chainId)
    let context: MigrationContext = {
      chain,
      admin,
      timestamp: timestamp(),
      cmdArgs,
      // Run a sub-procedure in the same context,
      // but without mutating the context.
      async run (procedure: Function, args: Record<string, any> = {}): Promise<any> {
        console.log()
        console.info('Running procedure:', bold(procedure.name))
        const T0 = + new Date()
        let fail = false
        try {
          const result = await procedure({ ...context, ...args })
          const T1 = + new Date()
          console.info(
            'Procedure', bold(procedure.name), colors.green('succeeded'),
            'in', T1-T0, 'msec'
          )
          return result
        } catch (e) {
          const T1 = + new Date()
          console.error(
            'Procedure', bold(procedure.name), colors.red(`failed`),
            `in`, T1-T0, 'msec:', e.message
          )
          throw e
        }
      },
    }
    const T0 = + new Date()
    const stepTimings = []
    // Composition of commands via steps:
    for (const step of steps) {
      if (!step) {
        console.warn(bold('Empty step in command'), commandName)
        continue
      }
      console.log()
      const name = step.name
      if (name) {
        console.info(bold('Running deploy step:'), name)
      } else {
        console.warn(bold('Running nameless deploy step. Please define deploy steps as named functions.'))
      }
      // Every step refreshes the context
      // by adding its outputs to it.
      const T1 = + new Date()
      let updates
      try {
        updates = await step({ ...context })
        context = { ...context, ...updates }
        const T2 = + new Date()
        console.info('Deploy step', bold(name), colors.green('succeeded'), 'in', T2-T1, 'msec')
        stepTimings.push([name, T2-T1, false])
      } catch (e) {
        const T2 = + new Date()
        console.error('Deploy step', bold(name), colors.red('failed'), 'in', T2-T1, 'msec')
        stepTimings.push([name, T2-T1, true])
        throw e
      }
    }
    const T3 = + new Date()
    console.log()
    console.info(`The command`, bold(commandName), `took`, ((T3-T0)/1000).toFixed(1), `s 🟢`)
    for (const [name, duration, isError] of stepTimings) {
      console.info(' ',isError?'🔴':'🟢', bold(name.padEnd(40)), (duration/1000).toFixed(1), 's')
    }
    return context
  }

}

function requireChainId (id, chains) {
  if (!id) {
    console.log('Please set your FADROMA_CHAIN environment variable to one of the following:')
    console.log('  '+Object.keys(chains).sort().join('\n  '))
    // TODO if interactive, display a selector which exports it for the session
    process.exit(1)
  }
}

export default new Fadroma()
