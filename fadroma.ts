/**

  Fadroma
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import { resolve, dirname } from 'path'
import { homedir }          from 'os'
import { fileURLToPath }    from 'url'

import $                                    from '@hackbg/kabinet'
import { Console, bold, colors, timestamp } from '@hackbg/konzola'

import { getScrtBuilder, getScrtDevnet }    from '@fadroma/ops-scrt'
import { ScrtChain }                        from '@fadroma/client-scrt'
import { LegacyScrt }                       from '@fadroma/client-scrt-amino'
import { Scrt }                             from '@fadroma/client-scrt-grpc'

import {
  Agent,
  AgentOpts,
  Artifact,
  Builder,
  CachingFSUploader,
  Chain,
  ChainMode,
  Client,
  ClientCtor,
  ClientOpts,
  Deployment,
  Deployments,
  FSUploader,
  Instance,
  Message,
  Mocknet,
  Source,
  Template,
  Uploader,
  join
} from '@fadroma/ops'

/** Update `process.env` with value from `.env` file */
import dotenv from 'dotenv'
dotenv.config()

export const __dirname = dirname(fileURLToPath(import.meta.url))

/// # Reexport the core platform vocabulary:

export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/tokens'
export * from '@hackbg/konzola'

/// # Define the top-level conventions and idioms:

export const console = Console('Fadroma Ops')

export class FadromaConfig {
  constructor (
    public readonly env: typeof process.env,
  ) {
    this.configureScrt()
  }
  getStr (name: string, fallback: ()=>string|null): string|null {
    if (this.env.hasOwnProperty(name)) {
      return String(process.env[name] as string)
    } else {
      return fallback()
    }
  }
  getBool (name: string, fallback: ()=>boolean|null): boolean|null {
    if (this.env.hasOwnProperty(name)) {
      return Boolean(process.env[name] as string)
    } else {
      return fallback()
    }
  }
  /** Project settings. */
  project = {
    /** The project's root directory. */
    root:         this.getStr( 'FADROMA_PROJECT',            ()=>process.cwd()),
    /** The selected chain backend. */
    chain:        this.getStr( 'FADROMA_CHAIN',              ()=>undefined),
  }
  /** System settings. */
  system = {
    /** The user's home directory. */
    homeDir:      this.getStr( 'HOME',                       ()=>homedir()),
    /** Address of Docker socket to use. */
    dockerHost:   this.getStr( 'DOCKER_HOST',                ()=>'/var/run/docker.sock'),
  }
  /** Build settings. */
  build = {
    /** URL to the build manager endpoint, if used. */
    manager:      this.getStr( 'FADROMA_BUILD_MANAGER',      ()=>null),
    /** Whether to bypass Docker and use the toolchain from the environment. */
    raw:          this.getBool('FADROMA_BUILD_RAW',          ()=>null),
    /** Whether to ignore existing build artifacts and rebuild contracts. */
    rebuild:      this.getBool('FADROMA_REBUILD',            ()=>false),
    /** Whether not to run `git fetch` during build. */
    noFetch:      this.getBool('FADROMA_NO_FETCH',           ()=>false),
    /** Whether not to run `git fetch` during build. */
    toolchain:    this.getStr('FADROMA_RUST',                ()=>''),
  }
  /** Devnet settings. */
  devnet = {
    /** URL to the devnet manager endpoint, if used. */
    manager:      this.getStr( 'FADROMA_DEVNET_MANAGER',     ()=>null),
    /** Whether to remove the devnet after the command ends. */
    ephemeral:    this.getBool('FADROMA_DEVNET_EPHEMERAL',   ()=>false),
    /** Chain id for devnet .*/
    chainId:      this.getStr( 'FADROMA_DEVNET_CHAIN_ID',    ()=>"fadroma-devnet"),
    /** Port for devnet. */
    port:         this.getStr( 'FADROMA_DEVNET_PORT',        ()=>null),
  }
  /** Upload settings. */
  upload = {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload:     this.getBool('FADROMA_REUPLOAD',           ()=>false),
  }
  /** DataHub API settings. */
  datahub = {
    /** API key for Figment DataHub APIs. */
    key:          this.getStr( 'FADROMA_DATAHUB_KEY',        ()=>null),
    /** Whether to apply DataHub rate limits */
    rateLimit:    this.getBool('FADROMA_DATAHUB_RATE_LIMIT', ()=>false)
  }
  /** Secret Network settings. */
  scrt = {
    agent: {
      name:       this.getStr( 'SCRT_AGENT_NAME',            ()=>null),
      address:    this.getStr( 'SCRT_AGENT_ADDRESS',         ()=>null),
      mnemonic:   this.getStr( 'SCRT_AGENT_MNEMONIC',        ()=>null),
    },
    build: {
      dockerfile: this.getStr( 'SCRT_BUILD_DOCKERFILE',      ()=>this.$('packages/ops-scrt/build.Dockerfile')),
      image:      this.getStr( 'SCRT_BUILD_IMAGE',           ()=>'hackbg/fadroma-scrt-builder:1.2'),
      script:     this.getStr( 'SCRT_BUILD_SCRIPT',          ()=>this.$('packages/ops-scrt/build-impl.mjs')),
      service:    this.getStr( 'SCRT_BUILD_SERVICE',         ()=>this.$('packages/ops-scrt/build-server.mjs')),
    },
    mainnet: {
      chainId:    this.getStr( 'SCRT_MAINNET_CHAIN_ID',      ()=>'secret-4'),
      apiUrl:     this.getStr( 'SCRT_MAINNET_API_URL',       ()=>null),
    },
    testnet: {
      chainId:    this.getStr( 'SCRT_TESTNET_CHAIN_ID',      ()=>'pulsar-2'),
      apiUrl:     this.getStr( 'SCRT_TESTNET_API_URL',       ()=>null),
    }
  }

  $ (...args) {
    // file finder function.
    // FIXME: won't find em when installed through npm
    return resolve(__dirname, ...args)
  }

  private configureScrt () {
    if (this.project.chain.startsWith('LegacyScrt')) {
      if (this.scrt.mainnet.apiUrl === null) {
        this.scrt.mainnet.apiUrl =
          `https://${this.scrt.mainnet.chainId}--lcd--full.datahub.figment.io`+
          `/apikey/${this.datahub.key}/`
      }
      if (this.scrt.testnet.apiUrl === null) {
        this.scrt.testnet.apiUrl =
          `https://${this.scrt.testnet.chainId}--lcd--full.datahub.figment.io`+
          `/apikey/${this.datahub.key}/`
      }
    } else if (this.project.chain.startsWith('Scrt')) {
      if (this.scrt.mainnet.apiUrl === null) {
        this.scrt.mainnet.apiUrl = 'https://secret-4.api.trivium.network:9091'
      }
      if (this.scrt.testnet.apiUrl === null) {
        this.scrt.testnet.apiUrl = 'https://testnet-web-rpc.roninventures.io'
      }
    }
  }
}

export const currentConfig = new FadromaConfig(process.env)

export const chains = {
  async 'Mocknet'           (config = currentConfig) {
    return new Mocknet()
  },
  async 'LegacyScrtMainnet' (config = currentConfig) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new LegacyScrt(id, { url, mode })
  },
  async 'LegacyScrtTestnet' (config = currentConfig) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new LegacyScrt(id, { url, mode })
  },
  async 'LegacyScrtDevnet'  (config = currentConfig) {
    const mode = ChainMode.Devnet
    const node = await getScrtDevnet('1.2').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new LegacyScrt(id, { url, mode, node })
  },
  async 'ScrtMainnet'       (config = currentConfig) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new Scrt(id, { url, mode })
  },
  async 'ScrtTestnet'       (config = currentConfig) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new Scrt(id, { url, mode })
  },
  async 'ScrtDevnet'        (config = currentConfig) {
    const mode = ChainMode.Devnet
    const node = await getScrtDevnet('1.3').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new Scrt(id, { url, mode, node })
  },
}

export type Step<T, U> = (context: T) => U|Promise<U>

export interface Command {
  info:  string,
  steps: Step<unknown, unknown>[]
}

export class CommandCollection {
  constructor (public readonly name: string,) {}
  readonly commands: Record<string, Command> = {}
  command (name, info, ...steps) {
    this.commands[name] = { info, steps }
    return this
  }
  parse (args: string[]): [string, Command, string[]]|null {
    let commands = Object.entries(this.commands)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const nextCommands = []
      for (const [name, impl] of commands) {
        if (name === arg) {
          return [name, impl, args.slice(i+1)]
        } else if (name.startsWith(arg)) {
          nextCommands.push([name.slice(arg.length).trim(), impl])
        }
      }
      commands = nextCommands
      if (commands.length === 0) {
        return null
      }
    }
    return null
  }
}

export class Commands extends CommandCollection {
  constructor (
    name,
    private readonly before: Step<unknown, unknown>[] = [],
    private readonly after:  Step<unknown, unknown>[] = []
  ) {
    super(name)
    if (name === 'deploy') {
      this.before.push(print(console).chainStatus)
      this.command('reset',  'reset the devnet',                resetDevnet)
      this.command('list',   'print a list of all deployments', listDeployments)
      this.command('select', 'select a new active deployment',  selectDeployment)
      this.command('new',    'create a new empty deployment',   createDeployment)
      this.command('status', 'show the current deployment',     showDeployment)
    }
  }
  command (name, info, ...steps) {
    return super.command(name, info, ...this.before, ...steps, ...this.after)
  }
  /** For iterating on would-be irreversible mutations. */
  iteration (name, info, ...steps) {
    return this.command(name, info, deploymentIteration, ...steps)
    function deploymentIteration (context) {
      if (context.devMode) {
        return createDeployment(context)
      } else {
        return context
      }
    }
  }
  /** `export default myCommands.main(import.meta.url)` */
  entrypoint (url: string, args = process.argv.slice(2)): this {
    const self = this
    setTimeout(()=>{
      if (process.argv[1] === fileURLToPath(url)) {
        const command = this.parse(args)
        if (command) {
          const [cmdName, { info, steps }, cmdArgs] = command
          console.info('$ fadroma', bold($(process.argv[1]).shortPath), bold(cmdName), ...cmdArgs)
          return self.run(args)
        } else {
          console.error('Invalid command:', ...args)
          process.exit(1)
        }
      }
    }, 0)
    return self
  }
  async run (args = process.argv.slice(2)): Promise<void> {
    if (args.length === 0) {
      let longest = 0
      for (const name of Object.keys(this.commands)) {
        longest = Math.max(name.length, longest)
      }
      for (const [name, { info }] of Object.entries(this.commands)) {
        console.log(`    ... ${this.name} ${bold(name.padEnd(longest))}  ${info}`)
      }
      process.exit(1)
    }
    const command = this.parse(args)
    if (!command) {
      console.error('Invalid command', ...args)
      process.exit(1)
    }
    const [cmdName, { info, steps }, cmdArgs] = command
    Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
    let context = {
      config: currentConfig,
      cmdArgs,
      timestamp: timestamp(),
      /** Run a sub-procedure in the same context,
        * but without mutating the context. */
      async run <T, U> (procedure: Step<T, U>, args: Record<string, any> = {}): Promise<U> {
        if (!procedure) {
          throw new Error('Tried to run missing procedure.')
        }
        const params = Object.keys(args)
        console.info(
          'Running procedure', bold(procedure.name||'(unnamed)'),
          ...((params.length > 0) ? ['with custom', bold(params.join(', '))] : [])
        )
        try {
          //@ts-ignore
          return await procedure({ ...context, ...args })
        } catch (e) {
          throw e
        }
      },
    }
    const T0 = + new Date()
    const stepTimings = []
    // Composition of commands via steps:
    for (const i in steps) {
      const step = steps[i]
      if (!(step instanceof Function)) {
        const msg = [
          'Each command step must be a function, but',
          'step', bold(String(Number(i)+1)), 'in command', bold(this.name), bold(cmdName),
          'is something else:', step, `(${typeof step})`
        ].join(' ')
        throw new Error(msg)
      }
    }
    const longestName = steps.map(step=>step?.name||'').reduce((max,x)=>Math.max(max, x.length), 0)
    let error
    for (const step of steps) {
      const name = (step.name||'').padEnd(longestName)
      const T1 = + new Date()
      let updates
      try {
        updates = await step({ ...context })
        // Every step refreshes the context
        // by adding its outputs to it.
        context = { ...context, ...updates }
        // Bind every function in the context so that `this` points to the current context object.
        // This allows e.g. `deploy` to use the current value of `deployAgent`,
        // but may break custom bound functions when passing them through the context.
        Object.keys(context).forEach(key=>{
          if (context[key] instanceof Function) {
            context[key] = context[key].bind(context)
          }
        })
        const T2 = + new Date()
        stepTimings.push([name, T2-T1, false])
      } catch (e) {
        error = e
        const T2 = + new Date()
        stepTimings.push([name, T2-T1, true])
        break
      }
    }
    const T3 = + new Date()
    const result = error ? colors.red('failed') : colors.green('completed')
    console.info(`The command`, bold(cmdName), result, `in`, ((T3-T0)/1000).toFixed(3), `s`)
    for (const [name, duration, isError] of stepTimings) {
      console.info(
        isError?`${colors.red('FAIL')}`:`${colors.green('OK  ')}`,
        bold((name||'(nameless step)').padEnd(40)),
        (duration/1000).toFixed(1).padStart(10),
        's'
      )
    }
    if (error) {
      throw error
    }
  }
}

export function parallel (...commands) {
  return function parallelCommands (context) {
    return Promise.all(commands.map(command=>context.run(command)))
  }
}

export interface CommandContext {
  /** The runtime configuration of Fadroma */
  config:      FadromaConfig
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
  run <T, U, V extends object> (procedure: Step<T, U>, args?: V): Promise<U>
}

export interface ConfigContext {
  config:    FadromaConfig
  chainList: typeof chains
}

export type OperationContext =
  CommandContext &
  ConfigContext  &
  ChainContext   &
  AgentContext   &
  BuildContext   &
  UploadContext  &
  DeployContext

export async function getChain (context: {
  config?: { project: { chain: string, root: string } },
  chains?: Record<string, (config: FadromaConfig)=>Promise<Chain>>
}): Promise<Partial<ChainContext>> {
  const { config = currentConfig, chains: chainList = chains } = context
  const name = config.project.chain
  if (!name || !chains[name]) {
    console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
    console.info('Known chain names:')
    for (const chain of Object.keys(chains).sort()) {
      console.info(`  ${chain}`)
    }
    process.exit(1)
  }
  const chain = await chains[name](config)
  return {
    config,
    chains,
    chain,
    deployments: Deployments.fromConfig(chain, config.project.root),
    devMode:     chain.isDevnet || chain.isMocknet
  }
}

export interface ChainContext extends CommandContext {
  config:      Partial<FadromaConfig>,
  chains:      typeof chains,
  /** The blockhain API to use. */
  chain:       Chain,
  /** Collections of interlinked contracts on the active chain. */
  deployments: Deployments
  /** True if the chain is a devnet or mocknet */
  devMode:     boolean
}

export async function resetDevnet ({ chain }: { chain: Chain }) {
  if (!chain) {
    console.info('No active chain.')
  } else if (!chain.isDevnet) {
    console.info('This command is only valid for devnets.')
  } else {
    await chain.node.terminate()
  }
}

export async function getAgent (context: ChainContext): Promise<Partial<AgentContext>> {
  const { config = currentConfig, chain } = context
  const agentOpts: AgentOpts = { name: undefined }
  if (context.chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = 'ADMIN'
  } else if ((context.chain as any).isSecretNetwork) {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = config.scrt.agent.mnemonic
  }
  const agent = await chain.getAgent(agentOpts)
  return { agent }
}

export interface AgentContext extends ChainContext {
  /** An identity operating on the chain. */
  agent:       Agent
}

/** Print the status of a deployment. */
export async function showDeployment (context: ChainContext): Promise<void> {
  const { cmdArgs: [id] = [undefined] } = context
  let deployment = context.deployments.active
  if (id) {
    deployment = context.deployments.get(id)
  }
  if (deployment) {
    print(console).deployment(deployment)
  } else {
    console.info('No selected deployment on chain:', bold(context.chain.id))
  }
}

export async function selectDeployment (context: ChainContext): Promise<void> {
  const { deployments, cmdArgs: [id] = [undefined] } = context
  const list = deployments.list()
  if (list.length < 1) {
    console.info('\nNo deployments. Create one with `deploy new`')
  }
  if (id) {
    console.info(bold(`Selecting deployment:`), id)
    await deployments.select(id)
  }
  if (list.length > 0) {
    listDeployments(context)
  }
  if (deployments.active) {
    console.info(`Currently selected deployment:`, bold(deployments.active.prefix))
  } else {
    console.info(`No selected deployment.`)
  }
}

export async function listDeployments ({ chain, deployments }: ChainContext): Promise<void> {
  const list = deployments.list()
  if (list.length > 0) {
    console.info(`Deployments on chain ${bold(chain.id)}:`)
    for (let deployment of list) {
      if (deployment === deployments.KEY) continue
      const count = Object.keys(deployments.get(deployment).receipts).length
      if (deployments.active && deployments.active.prefix === deployment) {
        deployment = `${bold(deployment)} (selected)`
      }
      deployment = `${deployment} (${count} contracts)`
      console.info(` `, deployment)
    }
  } else {
    console.info(`No deployments on chain`, bold(chain.id))
  }
}

/** Add either the active deployment, or a newly created one, to the command context. */
export async function getOrCreateDeployment (context: AgentContext) {
  if (context.deployments.active) {
    return getDeployment(context)
  } else {
    return await createDeployment(context)
  }
}

/** Create a new deployment and add it to the command context. */
export async function createDeployment (context: AgentContext): Promise<Partial<DeployContext>> {
  const [ prefix = context.timestamp ] = context.cmdArgs
  await context.deployments.create(prefix)
  await context.deployments.select(prefix)
  return await getDeployment(context)
}

/** Add the currently active deployment to the command context. */
export async function getDeployment (
  context: ChainContext & { agent?: Agent }
): Promise<Partial<DeployContext>> {
  const deployment = context.deployments.active
  if (!deployment) {
    console.info('No selected deployment on chain:', bold(context.chain.id))
  }
  return await getDeployContext({ deployment, agent: context.agent })
}

export function getDeployContext (context: {
  deployment:   Deployment,
  agent?:       Agent,
  deployAgent?: Agent,
  clientAgent?: Agent,
  suffix?:      string
}): Partial<DeployContext> {
  const {
    deployment,
    agent,
    deployAgent = agent,
    clientAgent = agent
  } = context
  if (deployment) {
    return {
      prefix: deployment.prefix,
      suffix: context.suffix ?? `+${timestamp()}`,
      deployment,
      deployAgent,
      clientAgent,
      async deploy (name: string, template: Template, initMsg: Message) {
        if (!this.deployAgent) {
          throw new Error('Fadroma Ops: no deployAgent in context')
        }
        return await this.deployment.init(this.deployAgent, template, name, initMsg)
      },
      async deployMany (template: Template, configs: [string, Message][]) {
        if (!this.deployAgent) {
          throw new Error('Fadroma Ops: no deployAgent in context')
        }
        return await this.deployment.initMany(this.deployAgent, template, configs)
      },
      getInstance (name: string) {
        return this.deployment.get(name)
      },
      //@ts-ignore
      getClient (name: string, _Client = Client) {
        return this.clientAgent.getClient(Client, this.deployment.get(name))
      }
    }
  } else {
    return {
      prefix: null,
      suffix: context.suffix ?? `+${timestamp()}`,
      deployment,
      deployAgent,
      clientAgent,
      getInstance (name: string) {
        throw new Error('Fadroma Ops: no active deployment')
      },
      async deploy (name: string, template: Template, initMsg: Message) {
        throw new Error('Fadroma Ops: no active deployment')
      },
      async deployMany (template: Template, configs: [string, Message][]) {
        throw new Error('Fadroma Ops: no active deployment')
      },
      getClient (name: string, Client) {
        throw new Error('Fadroma Ops: no active deployment')
      }
    }
  }
}

/** The part of OperationContext that deals with deploying
  * groups of contracts and keeping track of the receipts. */
export interface DeployContext extends ChainContext {
  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment
  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix:       string
  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:      string
  /** Who'll deploy new contracts */
  deployAgent?: Agent
  /** Shorthand for calling `deployment.init(deployAgent, ...)` */
  deploy:       (name: string, template: Template, initMsg: Message) => Promise<Instance>
  /** Shorthand for calling `deployment.initMany(deployAgent, ...)` */
  deployMany:   (template: Template, configs: [string, Message][]) => Promise<Instance[]>
  /** Who'll interact with existing contracts */
  clientAgent?: Agent
  /** Shorthand for calling `deployment.get(name)` */
  getInstance:  (name: string) => Instance
  /** Shorthand for calling `clientAgent.getClient(Client, deployment.get(name))` */
  getClient:    <C extends Client, O extends ClientOpts>(name: string, Client?: ClientCtor<C, O>)=>C
}

export function enableScrtBuilder ({ config }: {
  config: { build: { rebuild: boolean }, scrt: { build: object } }
}) {
  const builder = getScrtBuilder({ ...config.build, ...config.scrt.build })
  return getBuildContext(builder)
}

export function getBuildContext (builder: Builder): BuildContext {
  return {
    builder,
    async build (source: (Source|string)): Promise<Artifact> {
      return await builder.build(source)
    },
    async buildMany (sources: (Source|string)[]): Promise<Artifact[]> {
      return await builder.buildMany(sources)
    }
  }
}

/** The part of OperationContext that deals with building
  * contracts from source code to WASM artifacts */
export interface BuildContext {
  builder?:   Builder
  build?:     (source:   Source|string   )=> Promise<Artifact>
  buildMany?: (sources: (Source|string)[]) => Promise<Artifact[]>
}

/** Add an uploader to the command context. */
export function getFileUploader (context: {
  agent:    Agent
  caching?: boolean
  config:   { project: { root: string }, upload: { reupload: boolean } },
} & Partial<BuildContext>): UploadContext {
  const {
    config,
    agent: { chain: { isMocknet } },
    agent,
    caching = !config.upload.reupload,
    build,
    buildMany
  } = context
  const uploader = (!isMocknet && caching)
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
    async buildAndUpload (source: Source|string): Promise<Template> {
      if (!build) {
        throw new Error('Builder is not specified.')
      }
      return await uploader.upload(await build(source))
    },
    async buildAndUploadMany (sources: (Source|string)[]): Promise<Template[]> {
      if (!buildMany) {
        throw new Error('Builder is not specified.')
      }
      return await uploader.uploadMany(await buildMany(sources))
    }
  }
}

/** The part of OperationContext that deals with uploading
  * contract code to the platform. */
export interface UploadContext {
  uploader?:          Uploader
  upload:             (artifact:  Artifact        ) => Promise<Template>
  uploadMany:         (artifacts: Artifact[]      ) => Promise<Template[]>
  buildAndUpload:     (source:    Source|string   ) => Promise<Template>
  buildAndUploadMany: (sources:  (Source|string)[]) => Promise<Template[]>
}

export const print = console => {
  const print = {
    chainStatus ({ chain, deployments }) {
      if (!chain) {
        console.info('No active chain.')
      } else {
        console.info(bold('Chain type: '), chain.constructor.name)
        console.info(bold('Chain mode: '), chain.mode)
        console.info(bold('Chain ID:   '), chain.id)
        console.info(bold('Chain URL:  '), chain.url.toString())
        console.info(bold('Deployments:'), deployments.list().length)
      }
    },
    url ({ protocol, hostname, port }: URL) {
      console.info(bold(`Protocol: `), protocol)
      console.info(bold(`Host:     `), `${hostname}:${port}`)
    },
    async agentBalance (agent: Agent) {
      console.info(bold(`Agent:    `), agent.address)
      try {
        const initialBalance = await agent.balance
        console.info(bold(`Balance:  `), initialBalance, `uscrt`)
      } catch (e) {
        console.warn(bold(`Could not fetch balance:`), e.message)
      }
    },
    identities (chain: any) {
      console.log('\nAvailable identities:')
      for (const identity of chain.identities.list()) {
        console.log(`  ${chain.identities.load(identity).address} (${bold(identity)})`)
      }
    },
    aligned (obj: Record<string, any>) {
      const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 15)
      for (let [key, val] of Object.entries(obj)) {
        if (typeof val === 'object') val = JSON.stringify(val)
        val = String(val)
        if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
        console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
      }
    },
    contracts (contracts) {
      contracts.forEach(print.contract)
    },
    contract (contract) {
      console.info(
        String(contract.codeId).padStart(12),
        contract.address,
        contract.name
      )
    },
    async token (TOKEN) {
      if (typeof TOKEN === 'string') {
        console.info(
          `   `,
          bold(TOKEN.padEnd(10))
        )
      } else {
        const {name, symbol} = await TOKEN.info
        console.info(
          `   `,
          bold(symbol.padEnd(10)),
          name.padEnd(25).slice(0, 25),
          TOKEN.address
        )
      }
    },
    deployment ({ receipts, prefix }) {
      let contracts: string|number = Object.values(receipts).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      console.info('Active deployment:', bold(prefix), bold(contracts))
      const count = Object.values(receipts).length
      if (count > 0) {
        for (const name of Object.keys(receipts).sort()) {
          print.receipt(name, receipts[name])
        }
      } else {
        console.info('This deployment is empty.')
      }
    },
    receipt (name, receipt) {
      if (receipt.address) {
        console.info(
          `${receipt.address}`.padStart(45),
          String(receipt.codeId||'n/a').padStart(6),
          bold(name.padEnd(35)),
        )
      } else {
        console.warn(
          '(non-standard receipt)'.padStart(45),
          'n/a'.padEnd(6),
          bold(name.padEnd(35)),
        )
      }
    }
  }
  return print
}
