import {
  Console, print, bold, colors, timestamp,
  Chain, ChainMode, Agent, Deployments,
  MigrationContext, runMigration,
  FSUploader, CachingFSUploader,
  fileURLToPath, relative,
  config,
  Mocks,
  runCommands
} from '@fadroma/ops'

import { Mocknet } from '@fadroma/mocknet'

// Reexport the main libraries
export * from '@fadroma/ops'
export * from '@fadroma/scrt'
export * from '@fadroma/snip20'

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('@hackbg/fadroma')

// The namedChains are functions keyed by chain id,
// which give you the appropriate Chain and Agent
// for talking to that chain id.
import { Scrt_1_2 } from '@fadroma/scrt'
export { Scrt_1_2 }
Object.assign(Chain.namedChains, {
  'Scrt_1_2_Mainnet': Scrt_1_2.chains.Mainnet,
  'Scrt_1_2_Testnet': Scrt_1_2.chains.Testnet,
  'Scrt_1_2_Devnet':  Scrt_1_2.chains.Devnet,
  'Mocknet': () => {
    console.warn(bold('HELP WANTED:'), 'The Mocknet is far from implemented.')
    return Mocks.Chains.Mocknet()
  },
})

export type Command<T> = (MigrationContext)=>Promise<T>
export type WrappedCommand<T> = (args: string[])=>Promise<T>
export type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

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
      requireChainId(config.chain)
      const getChain = Chain.namedChains[config.chain]
      const chain = await getChain()
      const agent = await chain.getAgent()
      await print.agentBalance(agent)
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

// Default export is an interface to @fadroma/cli,
// a command runner based on @hackbg/komandi.
export default new Fadroma()

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
