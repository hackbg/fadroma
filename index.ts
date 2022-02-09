export * from '@fadroma/ops'
export * from '@fadroma/scrt'
export * from '@fadroma/snip20'

import {
  Console, bold, colors, timestamp,
  initChainAndAgent, Chain, Agent, Deployment, Mocknet
} from '@fadroma/ops'
import Scrt_1_0 from '@fadroma/scrt-1.0'
import Scrt_1_2 from '@fadroma/scrt-1.2'
import { fileURLToPath } from 'url'
import runCommands from '@hackbg/komandi'

export { Scrt_1_0, Scrt_1_2 }

export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

export type ChainCtor = (options?: Chain)=>Chain
export type Chains    = Record<string, ChainCtor>
export const CHAINS: Chains = { 'mocknet': () => new Mocknet() }
Object.assign(CHAINS, Scrt_1_0.Chains)
Object.assign(CHAINS, Scrt_1_2.Chains)

export type MigrationContext = {
  timestamp:   string
  /** Identify the blockhain being used. */
  chain:       Chain
  /** An identity operating on the chain. */
  agent:       Agent
  /** Override agent used for uploads. */
  uploadAgent: Agent
  /** Override agent used for deploys. */
  deployAgent: Agent
  /** Override agent used for normal operation. */
  clientAgent: Agent
  /** Manages a collection of interlinked contracts. */
  deployment?: Deployment,
  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix?:     string,
  /** Appended to contract labels in localnet deployments for faster iteration. */
  suffix?:     string,
  /** Arguments from the CLI invocation. */
  cmdArgs:     string[]
  /** Run a procedure in the migration context.
    * Procedures are async functions that take 1 argument:
    * the result of merging `args?` into `context`. */
  run <T extends object, U> (procedure: Function, args?: T): Promise<U>
}

const console = Console('@fadroma/cli')

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
    requireChainId(this.chainId, this.chains)

    const { chain, agent } = await initChainAndAgent(this.chains, this.chainId)

    let context: MigrationContext = {
      cmdArgs,
      timestamp: timestamp(),
      chain,
      agent,
      uploadAgent: agent,
      deployAgent: agent,
      clientAgent: agent,
      suffix: `+${timestamp()}`,
      // Run a sub-procedure in the same context,
      // but without mutating the context.
      async run <T> (procedure: Function, args: Record<string, any> = {}): Promise<T> {
        console.info(bold('Running procedure:'), procedure.name||'(unnamed)', '{', Object.keys(args).join(' '), '}')
        const T0 = + new Date()
        let fail = false
        try {
          const result = await procedure({ ...context, ...args })
          const T1 = + new Date()
          return result
        } catch (e) {
          const T1 = + new Date()
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
      const T1 = + new Date()
      let updates
      try {
        updates = await step({ ...context })
        // Every step refreshes the context
        // by adding its outputs to it.
        context = { ...context, ...updates }
        const T2 = + new Date()

        console.info('🟢 Deploy step', bold(name), colors.green('succeeded'), 'in', T2-T1, 'msec')
        stepTimings.push([name, T2-T1, false])
      } catch (e) {
        const T2 = + new Date()
        console.error('🔴 Deploy step', bold(name), colors.red('failed'), 'in', T2-T1, 'msec')
        stepTimings.push([name, T2-T1, true])
        console.error('Command', bold(name), colors.red('failed'), 'in', T2-T0, 'msec')
        throw e
      }
    }
    const T3 = + new Date()
    console.log()
    console.info(`The command`, bold(commandName), `took`, ((T3-T0)/1000).toFixed(1), `s 🟢`)
    for (const [name, duration, isError] of stepTimings) {
      console.info(' ',isError?'🔴':'🟢', bold((name||'(nameless step)').padEnd(40)), (duration/1000).toFixed(1).padStart(10), 's')
    }
    return context
  }

}

function requireChainId (id, chains) {
  if (!id) {
    console.error('Please set your FADROMA_CHAIN environment variable to one of the following:')
    console.error('  '+Object.keys(chains).sort().join('\n  '))
    // TODO if interactive, display a selector which exports it for the session
    process.exit(1)
  }
}

export default new Fadroma()
