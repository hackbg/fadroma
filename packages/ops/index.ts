import dotenv from 'dotenv'
dotenv.config()

import { config } from './Config'
config.fromEnv(process.env as any)

export { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
export * from '@hackbg/toolbox'
export * from '@fadroma/client'
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
import { Deployment, Deployments } from './Deploy'

export type Operation<T> = (context: OperationContext) => Promise<T>

export interface CommandContext {
  /** The moment at which the operation commenced. */
  timestamp:   string

  /** Arguments from the CLI invocation. */
  cmdArgs:     string[]

  /** Run a procedure in the operation context.
    * - Procedures are functions that take 1 argument:
    *   the result of merging `args?` into `context`.
    * - Procedures can be sync or async
    * - The return value of a procedure is *not* merged
    *   into the context for subsequent steps. */
  run <T extends object, U> (procedure: Function, args?: T): Promise<U>
}

export interface ConnectedContext {
  /** Identifies the blockhain being used. */
  chain:       Chain

  /** Collection of interlinked contracts that are known for the active chain. */
  deployments?: Deployments
}

export interface AuthenticatedContext {
  /** An identity operating on the chain. */
  agent:       Agent

  /** Override agent used for normal operation. */
  clientAgent: Agent
}

export interface BuildContext {
  ref?: string

  src?: Source

  srcs?: Source[]

  builder?: Builder

  build?: (source: Source) => Promise<Artifact>

  buildMany?: (...sources: Source[]) => Promise<Artifact[]>
}

export interface UploadContext {
  uploader?: Uploader

  upload: (artifact: Artifact) => Promise<Template>

  uploadMany: (...artifacts: Artifact[]) => Promise<Template[]>

  buildAndUpload: (source: Source) => Promise<Template>

  buildAndUploadMany: (...sources: Source[]) => Promise<Template[]>
}

export interface DeployContext {

  template?:    Template

  templates?:   Template[]

  /** Override agent used for deploys. */
  deployAgent?: Agent

  /** Currently selected collection of interlinked contracts. */
  deployment?:  Deployment

  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix?:      string

  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:      string

}

export type OperationContext =
  CommandContext       &
  ConnectedContext     &
  AuthenticatedContext &
  BuildContext         &
  UploadContext        &
  DeployContext

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
      const params = Object.keys(args)
      console.info(
        'Running procedure', bold(procedure.name||'(unnamed)'),
        ...((params.length > 0) ? ['with custom', bold(params.join(', '))] : [])
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
