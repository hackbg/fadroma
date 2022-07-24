import { Console, bold, colors, timestamp } from '@hackbg/konzola'
import { Chain, Agent } from '@fadroma/client'
import type { BuildContext } from './Build'
import type { UploadContext } from './Upload'
import type { DeployContext } from './Deploy'
import { Deployments } from './Deploy'

/** A function that runs in the operation context.
  * May be synchronous or asynchronous: runOperation conforms it to async using Promise.resolve() */
export type Operation<T> = (context: OperationContext) => T|Promise<T>

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

export type { BuildContext, UploadContext, DeployContext }

export * from '@hackbg/formati'
export * from '@fadroma/client'
export * from './Build'
export * from './Schema'
export * from './Devnet'
export * from './Upload'
export * from './Deploy'
export * from './Print'
export * from './Mocknet'
export * from './Endpoint'
