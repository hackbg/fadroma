import dotenv from 'dotenv'
dotenv.config()

import { config } from './Config'
config.fromEnv(process.env as any)

export * from '@hackbg/toolbox'
export * from '@fadroma/client'
export * from './Core'
export * from './Config'
export * from './Build'
export * from './Schema'
export * from './Devnet'
export * from './Upload'
export * from './Deploy'
export * from './Print'
export * from './Mocknet'
export * from './State'
export * from './Endpoint'

import TOML from 'toml'
export { TOML }

import { Console, bold, colors, timestamp } from '@hackbg/toolbox'
import { Chain, Agent, Artifact, Template } from '@fadroma/client'
import { Source, Builder } from './Build'
import { Uploader } from './Upload'
import { Deployment } from './Deploy'

export type Operation<T> = (context: OperationContext) => Promise<T>

export interface OperationContext {
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

const console = Console('Fadroma Ops')

export async function runOperation (
  cmdName:  string,
  steps:    Function[],
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

  console.log()
  const T0 = + new Date()
  const stepTimings = []

  // Composition of commands via steps:
  for (const i in steps) {
    const step = steps[i]
    if (!(step instanceof Function)) {
      const msg = [
        'Each command step must be a function, but',
        'step', bold(String(Number(i)+1)), 'in command', bold(cmdName),
        'is something else:', step, `(${typeof step})`
      ].join(' ')
      throw new Error(msg)
    }
  }

  const longestName = steps.map(step=>step?.name||'').reduce((max,x)=>Math.max(max, x.length), 0)
  for (const step of steps) {
    const name = (step.name||'').padEnd(longestName)
    const T1 = + new Date()
    let updates
    try {
      updates = await step({ ...context })
      // Every step refreshes the context
      // by adding its outputs to it.
      context = { ...context, ...updates }
      const T2 = + new Date()
      console.info('🟢', colors.green('OK  '), bold(name), ` (${bold(String(T2-T1))}ms)\n`)
      stepTimings.push([name, T2-T1, false])
    } catch (e) {
      const T2 = + new Date()
      console.error('🔴', colors.red('FAIL'), bold(name), ` (${bold(String(T2-T1))}ms)`)
      stepTimings.push([name, T2-T1, true])
      throw e
    }
  }

  const T3 = + new Date()
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

export async function buildAndUpload (
  builder: Builder, uploader: Uploader, source: Source
): Promise<Template> {
  const artifact = await builder.build(source)
  const template = await uploader.upload(artifact)
  return template
}

export async function buildAndUploadMany (
  builder: Builder, uploader: Uploader, ...sourceSets: Source[][]
): Promise<Template[]> {
  const sources   = sourceSets.reduce((sources, sourceSet)=>sources.concat(sourceSet), [])
  const artifacts = await builder.buildMany(sources)
  const templates = await uploader.uploadMany(artifacts)
  return templates
}
