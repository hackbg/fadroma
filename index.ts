import { fileURLToPath } from 'url'
import { relative } from 'path'

import {
  Agent,
  Artifact,
  CachingFSUploader,
  Chain,
  ChainMode,
  Deployment,
  Deployments,
  FSUploader,
  Mocknet,
  Operation,
  OperationContext,
  Source,
  Template,
  Uploader,
  config,
  getDeployments,
  join,
  print,
  runOperation,
  timestamp,
} from '@fadroma/ops'

import { runCommands } from '@hackbg/komandi'
import { Console, bold, colors } from '@hackbg/konzola'

import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt } from '@fadroma/client-scrt-grpc'
import { getScrtBuilder, getScrtDevnet, scrtConfig } from '@fadroma/ops-scrt'

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('Fadroma Ops')

export const Chains = {

  async 'Mocknet' () {
    return new Mocknet()
  },

  async 'LegacyScrtMainnet' () {
    return new LegacyScrt(scrtConfig.scrt.mainnetChainId, {
      url:  scrtConfig.scrt.mainnetApiUrl,
      mode: Chain.Mode.Mainnet
    })
  },

  async 'LegacyScrtTestnet' () {
    return new LegacyScrt(scrtConfig.scrt.testnetChainId, {
      url:  scrtConfig.scrt.testnetApiUrl,
      mode: Chain.Mode.Testnet
    })
  },

  async 'LegacyScrtDevnet'  () {
    const node = await getScrtDevnet('1.2').respawn()
    return new LegacyScrt(node.chainId, {
      url:  node.url.toString(),
      mode: Chain.Mode.Devnet,
      node
    })
  },

  async 'ScrtMainnet' () {
    return new Scrt(scrtConfig.scrt.mainnetChainId, {
      url:  scrtConfig.scrt.mainnetApiUrl,
      mode: Chain.Mode.Mainnet
    })
  },

  async 'ScrtTestnet' () {
    return new Scrt(scrtConfig.scrt.testnetChainId, {
      url:  scrtConfig.scrt.testnetApiUrl,
      mode: Chain.Mode.Testnet
    })
  },

  async 'ScrtDevnet' () {
    const node = await getScrtDevnet('1.3').respawn()
    return new Scrt(node.chainId, {
      url:  node.url.toString(),
      mode: Chain.Mode.Devnet,
      node
    })
  },

}

const BuildOps = {
  /** Add a Secret Network builder to the command context. */
  Scrt: function enableScrtBuilder () {
    const builder = getScrtBuilder()
    return {
      builder,
      async build (source: Source): Promise<Template> {
        return await builder.build(source)
      },
      async buildMany (...sources: Source[]): Promise<Template[]> {
        return await builder.buildMany(sources)
      }
    }
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
    const agentOptions = { name: undefined }
    if (chain.isDevnet) agentOptions.name = 'ADMIN'
    const agent = await chain.getAgent(agentOptions)
    return { chain, agent, deployAgent: agent, clientAgent: agent }
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
      console.info(bold('Chain dir: '), relative(config.projectRoot, chain.stateRoot.path))
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
  buildMany?: (...sources: Source[]) => Promise<Artifact[]>,
}

export interface UploadContext {
  uploader:           Uploader
  upload:             (artifact: Artifact)       => Promise<Template>
  uploadMany:         (...artifacts: Artifact[]) => Promise<Template[]>
  buildAndUpload:     (source: Source)           => Promise<Template>
  buildAndUploadMany: (...sources: Source[])     => Promise<Template[]>
}

export const UploadOps = {

  /** Add an uploader to the command context. */
  FromFile: function enableUploadingFromFile ({
    agent,
    caching = !config.reupload,
    build,
    buildMany
  }: UploadDependencies): UploadContext {
    const uploader = caching ? new CachingFSUploader(agent) : new FSUploader(agent)
    return {
      uploader,
      async upload (artifact: Artifact): Promise<Template> {
        return await uploader.upload(artifact)
      },
      async uploadMany (...artifacts: Artifact[]): Promise<Template[]> {
        return await uploader.uploadMany(artifacts)
      },
      async buildAndUpload (source: Source): Promise<Template> {
        if (!build) {
          throw new Error('Builder is not specified.')
        }
        return await uploader.upload(await build(source))
      },
      async buildAndUploadMany (...sources: Source[]): Promise<Template[]> {
        if (!buildMany) {
          throw new Error('Builder is not specified.')
        }
        return await uploader.uploadMany(await buildMany(...sources))
      }
    }
  }

}

export interface DeployContext {
  deployment: Deployment|undefined,
  prefix:     string|undefined
}

export interface DeploymentsContext {
  chain:        Chain
  cmdArgs?:     any[]
  deployments?: Deployments
}

export const DeployOps = {

  /** Create a new deployment and add it to the command context. */
  New: async function createDeployment ({
    chain,
    cmdArgs = [],
    deployments = getDeployments(chain)
  }: DeploymentsContext): Promise<DeployContext> {
    const [ prefix = timestamp() ] = cmdArgs
    await deployments.create(prefix)
    await deployments.select(prefix)
    return DeployOps.Append({ chain })
  },

  /** Add the currently active deployment to the command context. */
  Append: async function activateDeployment ({
    chain,
    deployments = getDeployments(chain)
  }: DeploymentsContext): Promise<DeployContext> {
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
  }: DeploymentsContext): Promise<DeployContext> {
    if (deployments.active) {
      return DeployOps.Append({ chain })
    } else {
      return await DeployOps.New({ chain, cmdArgs })
    }
  },

  /** Print the status of a deployment. */
  Status: async function printStatusOfDeployment ({
    chain,
    cmdArgs: [id] = [undefined],
    deployments = getDeployments(chain)
  }: DeploymentsContext) {
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
  }: DeploymentsContext) {
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

// Reexport the full vocabulary
export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/tokens'
