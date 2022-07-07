import { Console, bold, colors, timestamp } from '@hackbg/konzola'
import { Chain, Agent, AgentOpts } from '@fadroma/client'
import type { BuildContext } from './Build'
import type { UploadContext } from './Upload'
import type { DeployContext } from './Deploy'
import { Deployments } from './Deploy'

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

export interface AuthenticatedContext extends ConnectedContext {
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

interface GetChainFromEnvironment {
  config: {
    project: {
      chain: string
    },
    scrt: {
      agent: {
        mnemonic: string
      }
    }
  }
  Chains: Record<string, (config: unknown) => Promise<Chain>>
}

interface PrintChainStatus {
  chain: Chain
}

interface ResetDevnet {
  chain: Chain
}

export const ChainOps = {

  /** Populate the migration context with chain and agent. */
  FromEnv: async function getChainFromEnvironment (context: GetChainFromEnvironment) {
    const { config, Chains } = context
    const name = config.project.chain
    if (!name || !Chains[name]) {
      console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
      console.info('Known chain names:')
      for (const chain of Object.keys(Chains).sort()) {
        console.info(`  ${chain}`)
      }
      process.exit(1)
    }
    const chain = await Chains[name](config)
    const agentOpts: AgentOpts = { name: undefined }
    if (chain.isDevnet) {
      // for devnet, use auto-created genesis account
      agentOpts.name = 'ADMIN'
    } else if ((chain as any).isSecretNetwork) {
      // for scrt-based chains, use mnemonic from config
      agentOpts.mnemonic = config.scrt.agent.mnemonic
    }
    const agent = await chain.getAgent(agentOpts)
    return { chain, agent, clientAgent: agent }
  },

  /** Print the status of the active devnet */
  Status: async function printChainStatus ({ chain }: PrintChainStatus) {
    if (!chain) {
      console.info('No active chain.')
    } else {
      console.info(bold('Chain type:'), chain.constructor.name)
      console.info(bold('Chain mode:'), chain.mode)
      console.info(bold('Chain ID:  '), chain.id)
      console.info(bold('Chain URL: '), chain.url.toString())
    }
  },

  /** Reset the devnet. */
  Reset: async function resetDevnet ({ chain }: ResetDevnet) {
    if (!chain) {
      console.info('No active chain.')
    } else if (!chain.isDevnet) {
      console.info('This command is only valid for devnets.')
    } else {
      await chain.node.terminate()
    }
  }

}
