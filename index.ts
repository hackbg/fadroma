import {
  Console, print, bold, colors, timestamp,
  Chain, ChainMode, Mocknet, Agent,
  runOperation, Operation, OperationContext, 
  DeploymentOps, UploadOps,
  fileURLToPath, relative,
  config,
  runCommands,
} from '@fadroma/ops'

// Reexport the main libraries
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/snip20'

import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt }       from '@fadroma/client-scrt-grpc'

export { LegacyScrt, Scrt }

export const chains = {
  'Mocknet':           Mocknet,
  'LegacyScrtMainnet': LegacyScrt.Mainnet,
  'LegacyScrtTestnet': LegacyScrt.Testnet,
  'LegacyScrtDevnet':  LegacyScrt.Devnet,
  'ScrtMainnet':       Scrt.Mainnet,
  'ScrtTestnet':       Scrt.Testnet,
  'ScrtDevnet':        Scrt.Devnet,
}

export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands          = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('Fadroma Ops')

export class Fadroma {

  // metastatic!
  Build  = Fadroma.Build
  Chain  = Fadroma.Chain
  Upload = Fadroma.Upload
  Deploy = Fadroma.Deploy

  static Upload = UploadOps
  static Deploy = DeploymentOps

  static Build = {
    /** Add a builder to the command context. */
    Scrt: function enableScrtBuilder () {
      return { builder: Scrt.getBuilder() }
    }
  }

  static Chain = {

    /** Populate the migration context with chain and agent. */
    FromEnv: async function getChainFromEnvironment () {
      const name = config.chain
      if (!name || !chains[name]) {
        console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
        console.info('Known chain names:')
        for (const chain of Object.keys(chains).sort()) {
          console.info(`  ${chain}`)
        }
        throw new Error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
      }
      const chain = await chains[name]()
      const agent = await chain.getAgent()
      //await print(console).agentBalance(agent)
      return { chain, agent, deployAgent: agent, clientAgent: agent }
    },

    /** Print the status of the active devnet */
    Status: async function printChainStatus ({ chain }) {
      if (!chain) {
        console.info('No active chain.')
      } else {
        console.info(bold('Chain type:'), chain.constructor.name)
        console.info(bold('Chain mode:'), chain.mode)
        console.info(bold('Chain ID:  '), chain.id)
        console.info(bold('Chain URL: '), chain.apiURL.toString())
        console.info(bold('Chain dir: '), relative(config.projectRoot, chain.stateRoot.path))
      }
    },

    /** Reset the devnet. */
    Reset: async function resetDevnet ({ chain }) {
      if (!chain) {
        console.info('No active chain.')
      } else if (!chain.isDevnet) {
        console.info('This command is only valid for devnets.')
      } else {
        await chain.node.terminate()
      }
    }

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

  /** Establish correspondence between an input command
    * and a series of procedures to execute */
  command (name: string, ...steps: Command<any>[]) {
    const fragments = name.trim().split(' ')
    let commands: any = this.commands
    for (let i = 0; i < fragments.length; i++) {
      commands[fragments[i]] = commands[fragments[i]] || {}
      if (i === fragments.length-1) {
        commands[fragments[i]] = (...cmdArgs: string[]) => runOperation(name, steps, cmdArgs)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  /** Tree of command. */
  commands: Commands = {}

}

export default new Fadroma()
