import {
  Console, print, bold, colors, timestamp,
  Chain, ChainMode, Mocknet, Agent,
  Deployments, MigrationContext, runMigration,
  FSUploader, CachingFSUploader,
  fileURLToPath, relative,
  config,
  runCommands,
} from '@fadroma/ops'

// Reexport the main libraries
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/snip20'

import { Scrt_1_2 } from '@fadroma/scrt-1.2'
import { Scrt_1_3 } from '@fadroma/scrt-1.3'
export { Scrt_1_2, Scrt_1_3 }
Object.assign(Chain.namedChains, {
  'Mocknet':          Mocknet,
  'Scrt_1_2_Mainnet': Scrt_1_2.chains.Mainnet,
  'Scrt_1_2_Testnet': Scrt_1_2.chains.Testnet,
  'Scrt_1_2_Devnet':  Scrt_1_2.chains.Devnet,
  'Scrt_1_3_Mainnet': Scrt_1_3.chains.Mainnet,
  'Scrt_1_3_Testnet': Scrt_1_3.chains.Testnet,
  'Scrt_1_3_Devnet':  Scrt_1_3.chains.Devnet,
})

export type Command<T>        = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands          = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

Chain.namedChains['Mocknet'] = (options?) => new Mocknet('mocknet', options)

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('Fadroma Ops')

export class Fadroma {

  // metastatic!
  Build  = Fadroma.Build
  Chain  = Fadroma.Chain
  Upload = Fadroma.Upload
  Deploy = Fadroma.Deploy

  /** Adds a builder to the command context. */
  static Build = {
    Scrt_1_2: function enableScrtBuilder_1_2 () {
      return { builder: Scrt_1_2.getBuilder() }
    }
  }

  static Chain = {

    /** Populate the migration context with chain and agent. */
    FromEnv: async function getChainFromEnvironment () {
      const chain = await Chain.getNamed()
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

  /** Adds an uploader to the command context. */
  static Upload = {
    FromFile: function enableUploadingFromFile ({
      agent,
      caching = !config.reupload
    }) {
      if (caching) {
        return { uploader: new CachingFSUploader(agent) }
      } else {
        return { uploader: new FSUploader(agent) }
      }
    }
  }

  static Deploy = {
    /** Create a new deployment and adds it to the command context. */
    New:         Deployments.new,
    /** Add the currently active deployment to the command context. */
    Append:      Deployments.activate,
    /** Add the active deployment, or a new one, to the command context. */
    AppendOrNew: Deployments.activate,
    /** Print the status of the active deployment. */
    Status:      Deployments.status,
    /** Select a new active deployment from the available ones. */
    Select:      Deployments.select
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
        commands[fragments[i]] = (...cmdArgs: string[]) => runMigration(name, steps, cmdArgs)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  /** Tree of command. */
  commands: Commands = {}

}

export default new Fadroma()
