// Is this a monad?

import { Console, bold, colors, timestamp } from '@hackbg/toolbox'
import { Chain } from './Chain'
import { Agent } from './Agent'
import { Deployment } from './Deploy'
import { Source, Builder, Uploader, Template } from './Core'

export interface MigrationContext {
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
  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:     string,
  /** Arguments from the CLI invocation. */
  cmdArgs:     string[]
  /** Run a procedure in the migration context.
    * Procedures are async functions that take 1 argument:
    * the result of merging `args?` into `context`. */
  run <T extends object, U> (procedure: Function, args?: T): Promise<U>

  ref?:       string
  src?:       Source
  srcs?:      Source[]
  builder?:   Builder
  uploader?:  Uploader
  template?:  Template
  templates?: Template[]
}

export type Command<T> = (MigrationContext)=>Promise<T>

const console = Console('@fadroma/ops/Migrate')

export async function runMigration (
  cmdName:  string,
  steps:    Command<any>[],
  cmdArgs?: string[]
): Promise<any> {

  let context = {
    cmdArgs,
    timestamp: timestamp(),
    suffix: `+${timestamp()}`,
    /** Run a sub-procedure in the same context,
      * but without mutating the context. */
    async run <T> (procedure: Function, args: Record<string, any> = {}): Promise<T> {
      if (!procedure) {
        throw new Error('Tried to run missing procedure.')
      }
      console.info(
        bold('Running procedure:'), procedure.name||'(unnamed)',
        '{', Object.keys(args).join(' '), '}'
      )
      try {
        return await procedure({ ...context, ...args })
      } catch (e) {
        throw e
      }
    },
  }

  const T0 = + new Date()
  const stepTimings = []

  // Composition of commands via steps:
  const longestName = steps.map(step=>step?.name||'').reduce((max,x)=>Math.max(max, x.length), 0)
  for (const step of steps) {
    if (!step) {
      console.warn(bold('Empty step in command'), cmdName)
      continue
    }
    const name = (step.name||'').padEnd(longestName)
    const T1 = + new Date()
    let updates
    try {
      updates = await step({ ...context })
      // Every step refreshes the context
      // by adding its outputs to it.
      context = { ...context, ...updates }
      const T2 = + new Date()
      console.info('🟢', colors.green('OK  '), bold(name), ` (${bold(String(T2-T1))}ms)`)
      stepTimings.push([name, T2-T1, false])
    } catch (e) {
      const T2 = + new Date()
      console.error('🔴', colors.red('FAIL'), bold(name), ` (${bold(String(T2-T1))}ms)`)
      stepTimings.push([name, T2-T1, true])
      throw e
    }
  }

  const T3 = + new Date()
  console.log()
  console.info(`The command`, bold(cmdName), `took`, ((T3-T0)/1000).toFixed(1), `s 🟢`)
  for (const [name, duration, isError] of stepTimings) {
    console.info(
      ' ',
      isError?'🔴':'🟢',
      bold((name||'(nameless step)').padEnd(40)),
      (duration/1000).toFixed(1).padStart(10),
      's'
    )
  }

  return context

}

export function parallel (...commands) {
  return function parallelCommands (input) {
    return Promise.all(commands.map(command=>command(input)))
  }
}
