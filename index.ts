import { fileURLToPath } from 'url'
import {
  Agent,
  AgentOpts,
  Artifact,
  CachingFSUploader,
  Chain,
  ChainMode,
  CommandContext,
  ConnectedContext,
  DeployContext,
  Deployments,
  FSUploader,
  Message,
  Mocknet,
  Operation,
  Source,
  Template,
  UploadContext,
  join,
  print,
  runOperation,
} from '@fadroma/ops'

import { runCommands } from '@hackbg/komandi'
import { Console, bold } from '@hackbg/konzola'

import { ScrtChain } from '@fadroma/client-scrt'
import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt } from '@fadroma/client-scrt-grpc'
import { getScrtBuilder, getScrtDevnet } from '@fadroma/ops-scrt'

import config from './config'

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('Fadroma Ops')

export const Chains = {

  async 'Mocknet' () {
    return new Mocknet()
  },

  async 'LegacyScrtMainnet' () {
    return new LegacyScrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },

  async 'LegacyScrtTestnet' () {
    return new LegacyScrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },

  async 'LegacyScrtDevnet'  () {
    const node = await getScrtDevnet('1.2').respawn()
    return new LegacyScrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },

  async 'ScrtMainnet' () {
    return new Scrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },

  async 'ScrtTestnet' () {
    return new Scrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },

  async 'ScrtDevnet' () {
    const node = await getScrtDevnet('1.3').respawn()
    return new Scrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },

}

const BuildOps = {
  /** Add a Secret Network builder to the command context. */
  Scrt: function enableScrtBuilder () {
    const builder = getScrtBuilder({
      caching: !config.build.rebuild,
      ...config.scrt.build
    })
    return {
      builder,
      async build (source: Source): Promise<Template> {
        return await builder.build(source)
      },
      async buildMany (sources: Source[]): Promise<Template[]> {
        return await builder.buildMany(sources)
      }
    }
  }
}

const ChainOps = {

  /** Populate the migration context with chain and agent. */
  FromEnv: async function getChainFromEnvironment () {
    const name = config.project.chain
    if (!name || !Chains[name]) {
      console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
      console.info('Known chain names:')
      for (const chain of Object.keys(Chains).sort()) {
        console.info(`  ${chain}`)
      }
      process.exit(1)
    }
    const chain = await Chains[name]()
    const agentOpts: AgentOpts = { name: undefined }
    if (chain.isDevnet) {
      // for devnet, use auto-created genesis account
      agentOpts.name = 'ADMIN'
    } else if (chain instanceof ScrtChain) {
      // for scrt-based chains, use mnemonic from config
      agentOpts.mnemonic = config.scrt.agent.mnemonic
    }
    const agent = await chain.getAgent(agentOpts)
    return { chain, agent, clientAgent: agent }
  },

  /** Print the status of the active devnet */
  Status: async function printChainStatus ({ chain }: { chain: Chain }) {
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
  Reset: async function resetDevnet ({ chain }: { chain: Chain }) {
    if (!chain) {
      console.info('No active chain.')
    } else if (!chain.isDevnet) {
      console.info('This command is only valid for devnets.')
    } else {
      await chain.node.terminate()
    }
  }

}

export interface UploadDependencies {
  agent:      Agent,
  caching?:   boolean,
  build?:     (source: Source) => Promise<Artifact>,
  buildMany?: (sources: Source[]) => Promise<Artifact[]>,
}

export const UploadOps = {

  /** Add an uploader to the command context. */
  FromFile: function enableUploadingFromFile ({
    agent,
    caching = !config.upload.reupload,
    build,
    buildMany
  }: UploadDependencies): UploadContext {
    const uploader = caching
      ? CachingFSUploader.fromConfig(agent, config.project.root)
      : new FSUploader(agent)
    return {
      uploader,
      async upload (artifact: Artifact): Promise<Template> {
        return await uploader.upload(artifact)
      },
      async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
        return await uploader.uploadMany(artifacts)
      },
      async buildAndUpload (source: Source): Promise<Template> {
        if (!build) {
          throw new Error('Builder is not specified.')
        }
        return await uploader.upload(await build(source))
      },
      async buildAndUploadMany (sources: Source[]): Promise<Template[]> {
        if (!buildMany) {
          throw new Error('Builder is not specified.')
        }
        return await uploader.uploadMany(await buildMany(sources))
      }
    }
  }

}

export interface DeploymentsContext {
  chain:        Chain
  cmdArgs?:     string[]
  deployments?: Deployments
}

export const DeployOps = {

  /** Create a new deployment and add it to the command context. */
  New: async function createDeployment ({
    chain,
    timestamp,
    deployments = Deployments.fromConfig(chain, config.project.root),
    cmdArgs     = [],
  }: (CommandContext&ConnectedContext)): Promise<DeployContext> {
    const [ prefix = timestamp ] = cmdArgs
    await deployments.create(prefix)
    await deployments.select(prefix)
    return DeployOps.Append({ chain })
  },

  /** Add the currently active deployment to the command context. */
  Append: async function activateDeployment ({
    chain,
    //@ts-ignore
    agent,
    deployments = Deployments.fromConfig(chain, config.project.root)
  }: ConnectedContext): Promise<DeployContext> {
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
    return {
      prefix,
      deployment,
      deployAgent: agent,
      async deploy (template: Template, name: string, initMsg: Message) {
        return await deployment.init(agent, template, name, initMsg)
      }
    }
  },

  /** Add either the active deployment, or a newly created one, to the command context. */
  AppendOrNew: async function activateOrCreateDeployment ({
    run,
    timestamp,
    cmdArgs,
    chain,
    deployments = Deployments.fromConfig(chain, config.project.root)
  }: (CommandContext&ConnectedContext)): Promise<DeployContext> {
    if (deployments.active) {
      return DeployOps.Append({ chain })
    } else {
      return await DeployOps.New({ timestamp, cmdArgs, run, chain, deployments })
    }
  },

  /** Print the status of a deployment. */
  Status: async function printStatusOfDeployment ({
    cmdArgs: [id] = [undefined],
    chain,
    deployments = Deployments.fromConfig(chain, config.project.root)
  }: (CommandContext&ConnectedContext)) {
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
    cmdArgs: [id] = [undefined],
    chain,
    deployments = Deployments.fromConfig(chain, config.project.root)
  }: (CommandContext&ConnectedContext)) {
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

  // command preludes!

  /** Command prelude: add these steps to the start of a command
    * to enable building and uploading contracts *from* local sources
    * and *for* Secret Network 1.2, *ignoring* deployments. */
  canBuildAndUpload = [
    this.Chain.FromEnv,        // determine the chain to operate on
    this.Build.Scrt,           // enable building for Secret Network
    this.Upload.FromFile,      // enable uploading from local files
  ]

  /** Command prelude: add these steps to the start of a command
    * to enable building and uploading contracts *from* local sources
    * and *for* Secret Network 1.2, inside a *new* deployment. */
  inNewDeployment = [
    ...this.canBuildAndUpload, // standard setup, see above
    FadromaOps.Deploy.New      // create a new deployment upon commencement
  ]

  /** Command prelude: add these steps to the start of a command
    * to enable building and uploading contracts *from* local sources
    * and *for* Secret Network 1.2, inside the *currently selected* deployment. */
  inCurrentDeployment = [
    ...this.canBuildAndUpload, // standard setup, see above
    FadromaOps.Deploy.Append   // enable appending to the currently active deployment
  ]

  /** Call this with `import.meta.url` at the end of a command module.
    * TODO get rid of this mechanic and use "fadroma run" + default exports */
  module (url: string): this {
    // if main
    if (process.argv[1] === fileURLToPath(url)) {
      this.run(...process.argv.slice(2)).then(()=>{
        console.info('All done.')
        process.exit(0)
      })
    }
    return this
  }

  async run (...commands: string[]) {
    Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
    return await runCommands(this.commands, commands)
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

/// Reexport the platform vocabulary ///////////////////////////////////////////////////////////////

export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/tokens'
export * from '@hackbg/konzola'
