export * from '@fadroma/ops'
export * from '@fadroma/scrt'
export * from '@fadroma/snip20'
import Scrt_1_2 from '@fadroma/scrt-1.2'

import {
  Console, print, bold, colors, timestamp,
  Chain, Agent, Deployments, MigrationContext,
  FSUploader, CachingFSUploader,
  fileURLToPath
} from '@fadroma/ops'
import { Mocknet } from '@fadroma/mocknet'
import runCommands from '@hackbg/komandi'

const console = Console('@fadroma/cli')

export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

export const {
  FADROMA_UPLOAD_CACHE,
  FADROMA_CHAIN
} = process.env

export class Fadroma {

  // metastatic!
  Build  = Fadroma.Build
  Upload = Fadroma.Upload
  Deploy = Fadroma.Deploy

  /** Adds a builder to the command context. */
  static Build = {
    Scrt_1_2: function enableScrtBuilder_1_2 () {
      return { builder: Scrt_1_2.getBuilder() }
    }
  }

  /** Adds an uploader to the command context. */
  static Upload = {
    FromFile ({
      agent,
      caching = !!FADROMA_UPLOAD_CACHE
    }) {
      if (caching) {
        return { uploader: new CachingFSUploader(agent) }
      } else {
        return { uploader: new FSUploader(agent) }
      }
    }
  }

  static Deploy = {
    /** Creates a new deployment and adds it to the command context. */
    New:    Deployments.new,
    /** Adds the currently active deployment to the command context. */
    Append: Deployments.activate,
    /** Prints the status of the active deployment. */
    Status: Deployments.status,
  }

  /** Call this with `import.meta.url` at the end of a command module. */
  module (url: string): this {
    // if main
    if (process.argv[1] === fileURLToPath(url)) {
      this.run(...process.argv.slice(2))/*.then(()=>{
        console.info('All done.')
        process.exit(0)
      })*/
    }
    return this
  }

  async run (...commands: string[]) {
    Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
    runCommands.default(this.commands, commands)
  }

  chainId = FADROMA_CHAIN

  /** Establish correspondence between an input command
    * and a series of procedures to execute */
  command (name: string, ...steps: Command<any>[]) {
    const fragments = name.trim().split(' ')
    let commands: any = this.commands
    for (let i = 0; i < fragments.length; i++) {
      commands[fragments[i]] = commands[fragments[i]] || {}
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
    requireChainId(this.chainId)
    const getChain = Chain.namedChains[this.chainId]
    const chain = await getChain()
    const agent = await chain.getAgent()
    await print.agentBalance(agent)
    let context = {
      cmdArgs,
      timestamp: timestamp(),
      chain,
      agent,
      deployAgent: agent,
      clientAgent: agent,
      suffix: `+${timestamp()}`,
      // Run a sub-procedure in the same context,
      // but without mutating the context.
      async run <T> (procedure: Function, args: Record<string, any> = {}): Promise<T> {
        if (!procedure) {
          throw new Error('Tried to run missing procedure.')
        }
        console.info(
          bold('Running procedure:'), procedure.name||'(unnamed)',
          '{', Object.keys(args).join(' '), '}'
        )
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

function requireChainId (id, chains = Chain.namedChains) {

  if (!id || !chains[id]) {

    console.error('Please set your FADROMA_CHAIN environment variable to one of the following:')

    for (const chain of Object.keys(chains).sort()) {
      console.log(`  ${chain}`)
    }

    // TODO if interactive, display a selector which exports it for the session
    process.exit(1)
  }

  return chains[id]

}
