import {
  Console, print, bold, colors, timestamp,
  Chain, ChainMode, Mocknet, Agent,
  runOperation, Operation, OperationContext,
  Directory, getDeployments, Deployment,
  fileURLToPath, relative, resolve,
  config,
  runCommands,
  join,
  CachingFSUploader, FSUploader
} from '@fadroma/ops'

import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt }       from '@fadroma/client-scrt-grpc'

import {
  getScrtBuilder,
  getScrtDevnet_1_2,
  getScrtDevnet_1_3,
  scrtConfig
} from '@fadroma/ops-scrt'

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('Fadroma Ops')

export const Chains = {

  async 'Mocknet' () {
    return new Mocknet()
  },

  async 'LegacyScrtMainnet' () {
    return new LegacyScrt.Mainnet(scrtConfig.scrt.mainnetChainId, {
      url: scrtConfig.scrt.mainnetApiUrl
    })
  },

  async 'LegacyScrtTestnet' () {
    return new LegacyScrt.Testnet(scrtConfig.scrt.testnetChainId, {
      url: scrtConfig.scrt.testnetApiUrl
    })
  },

  async 'LegacyScrtDevnet'  () {
    const node = await getScrtDevnet_1_2().respawn()
    const url  = node.apiURL.toString()
    return new LegacyScrt.Devnet(node.chainId, { url, node })
  },

  async 'ScrtMainnet' () {
    return new Scrt.Mainnet(scrtConfig.scrt.mainnetChainId, {
      url: scrtConfig.scrt.mainnetApiUrl
    })
  },

  async 'ScrtTestnet' () {
    return new Scrt.Testnet(scrtConfig.scrt.testnetChainId, {
      url: scrtConfig.scrt.testnetApiUrl
    })
  },

  async 'ScrtDevnet' () {
    const node = await getScrtDevnet_1_3().respawn()
    const url  = node.apiURL.toString()
    return new Scrt.Devnet(node.chainId, { url, node })
  },

}

const BuildOps = {
  /** Add a Secret Network builder to the command context. */
  Scrt: function enableScrtBuilder () {
    const builder = getScrtBuilder()
    return { builder }
  }
}

const ChainOps = {

  /** Populate the migration context with chain and agent. */
  FromEnv: async function getChainFromEnvironment () {
    const name = config.chain
    if (!name || !Chains[name]) {
      console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
      console.info('Known chain names:')
      for (const chain of Object.keys(Chains).sort()) {
        console.info(`  ${chain}`)
      }
      process.exit(1)
    }
    const chain = await Chains[name]()
    console.log(chain)
    const agent = await chain.getAgent()
    console.log(agent)
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
export const UploadOps = {

  /** Add an uploader to the command context. */
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

export interface DeployContext {
  deployment: Deployment|undefined,
  prefix:     string|undefined
}

export const DeployOps = {

  /** Create a new deployment and add it to the command context. */
  New: async function createDeployment ({
    chain,
    cmdArgs = [],
    deployments = getDeployments(chain)
  }): Promise<DeployContext> {
    const [ prefix = timestamp() ] = cmdArgs
    await deployments.create(prefix)
    await deployments.select(prefix)
    return DeployOps.Append({ chain })
  },

  /** Add the currently active deployment to the command context. */
  Append: async function activateDeployment ({
    chain,
    deployments = getDeployments(chain)
  }): Promise<DeployContext> {
    const deployment = deployments.active
    if (!deployment) {
      console.error(join(bold('No selected deployment on chain:'), chain.id))
      process.exit(1)
    }
    const prefix = deployment.prefix
    let contracts: string|number = Object.values(deployment.receipts).length
    contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
    console.info(bold('Active deployment:'), prefix, contracts)
    print(console).deployment(deployment)
    return { deployment, prefix }
  },

  /** Add either the active deployment, or a newly created one, to the command context. */
  AppendOrNew: async function activateOrCreateDeployment ({
    chain,
    cmdArgs,
    deployments = getDeployments(chain)
  }): Promise<DeployContext> {
    if (deployments.active) {
      return DeployOps.Append({ chain })
    } else {
      return await DeployOps.new({ chain, cmdArgs })
    }
  },

  /** Print the status of a deployment. */
  Status: async function printStatusOfDeployment ({
    chain,
    cmdArgs: [id] = [undefined],
    deployments = getDeployments(chain)
  }) {
    let deployment = deployments.active
    if (id) {
      deployment = deployments.get(id)
    }
    if (!deployment) {
      console.error(join(bold('No selected deployment on chain:'), chain.id))
      process.exit(1)
    }
    print(console).deployment(deployment)
  },

  /** Set a new deployment as active. */
  Select: async function selectDeployment ({
    chain,
    cmdArgs: [id] = [undefined],
    deployments = getDeployments(chain)
  }) {
    const list = deployments.list()
    if (list.length < 1) {
      console.info('\nNo deployments. Create one with `deploy new`')
    }
    if (id) {
      console.info(bold(`Selecting deployment:`), id)
      await deployments.select(id)
    }
    if (list.length > 0) {
      console.info(bold(`Known deployments:`))
      for (let deployment of deployments.list()) {
        if (deployment === deployments.KEY) {
          continue
        }
        const count = Object.keys(deployments.get(deployment).receipts).length
        if (deployments.active && deployments.active.prefix === deployment) {
          deployment = `${bold(deployment)} (selected)`
        }
        deployment = `${deployment} (${count} contracts)`
        console.info(` `, deployment)
      }
    }
    console.log()
    deployments.printActive()
  }

}

type WrappedCommand<T> = (args: string[])=>Promise<T>

type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

export class FadromaOps {

  static Build  = BuildOps
  static Chain  = ChainOps
  static Upload = UploadOps
  static Deploy = DeployOps

  // metastatic!
  Build  = FadromaOps.Build
  Chain  = FadromaOps.Chain
  Upload = FadromaOps.Upload
  Deploy = FadromaOps.Deploy

  /** Call this with `import.meta.url` at the end of a command module.
    * TODO get rid of this mechanic and use "fadroma run" + default exports */
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

  /** Define a command. Establishes correspondence between
    * an input command and a series of procedures to execute
    * when calling run with a matching input */
  command (name: string, ...steps: Operation<any>[]) {
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

export default new FadromaOps()

export { LegacyScrt, Scrt }

// Reexport the full vocabulary
export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/snip20'
