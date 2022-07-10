import { fileURLToPath } from 'url'
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
} from '@fadroma/ops'
import {
  getScrtBuilder,
  getScrtDevnet
} from '@fadroma/ops-scrt'
import { runCommands } from '@hackbg/komandi'
import { Console, bold, colors, timestamp } from '@hackbg/konzola'
import { ScrtChain } from '@fadroma/client-scrt'
import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt } from '@fadroma/client-scrt-grpc'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { homedir } from 'os'

/** Update `process.env` with value from `.env` file */
dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))

export { LegacyScrt, Scrt }

// Reexport the core platform vocabulary:

export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/tokens'
export * from '@hackbg/konzola'

// Define the top-level conventions and idioms:

export const console = Console('Fadroma Ops')

export const chains = {
  async 'Mocknet'           (config = currentConfig) {
    return new Mocknet()
  },
  async 'LegacyScrtMainnet' (config = currentConfig) {
    return new LegacyScrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },
  async 'LegacyScrtTestnet' (config = currentConfig) {
    return new LegacyScrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },
  async 'LegacyScrtDevnet'  (config = currentConfig) {
    const node = await getScrtDevnet('1.2').respawn()
    return new LegacyScrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },
  async 'ScrtMainnet'       (config = currentConfig) {
    return new Scrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },
  async 'ScrtTestnet'       (config = currentConfig) {
    return new Scrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },
  async 'ScrtDevnet'        (config = currentConfig) {
    const node = await getScrtDevnet('1.3').respawn()
    return new Scrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },
}

export default function command (info: string, ...steps: Function[]) {
  return {
    info,
    steps: [ ...connect, ...steps ]
  }
}

export const connect = [
]

export async function populateChain (context: {
  config?:    FadromaConfig,
  chainList?: Record<string, (config: FadromaConfig)=>Promise<Chain>>
}): Promise<{
  chain: Chain,
}> {
  const { config = currentConfig, chainList = chains } = context
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
  return { chain }
}

export async function populateAgent (context: {
  config?: FadromaConfig,
  chain:   Chain
}): Promise<{
  agent: Agent
}> {
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

export function enableScrtBuilder ({ config }: {
  config: { build: { rebuild: boolean }, scrt: { build: object } }
}) {
  const builder = getScrtBuilder({ ...config.build, ...config.scrt.build })
  return populateBuildContext(builder)
}

export function populateBuildContext (builder: Builder): BuildContext {
  return {
    builder,
    async build (source: Source): Promise<Artifact> {
      return await builder.build(source)
    },
    async buildMany (sources: Source[]): Promise<Artifact[]> {
      return await builder.buildMany(sources)
    }
  }
}

/** The part of OperationContext that deals with building
  * contracts from source code to WASM artifacts */
export interface BuildContext {
  builder?:   Builder
  build?:     (source: Source) => Promise<Artifact>
  buildMany?: (sources: Source[]) => Promise<Artifact[]>
}

/** Add an uploader to the command context. */
export function enableFileUpload (context: {
  agent:      Agent
  caching?:   boolean
  build?:     (source: Source) => Promise<Artifact>
  buildMany?: (sources: Source[]) => Promise<Artifact[]>
  config: { project: { root: string }, upload: { reupload: boolean } },
}): UploadContext {
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

/** The part of OperationContext that deals with uploading
  * contract code to the platform. */
export interface UploadContext {
  uploader?:          Uploader
  upload:             (artifact: Artifact)    => Promise<Template>
  uploadMany:         (artifacts: Artifact[]) => Promise<Template[]>
  buildAndUpload:     (source: Source)        => Promise<Template>
  buildAndUploadMany: (sources: Source[])     => Promise<Template[]>
}

export async function enableDeployments (
  context: {
    config: { project: { root: string } }
    chain:        Chain
    deployments?: Deployments
  }
): Promise<DeploymentsContext> {
  if (!context.deployments) {
    const { chain, config: { project: { root } } } = context
    context.deployments = Deployments.fromConfig(chain, root)
  }
  return context
}

export interface DeploymentsContext {
  chain:        Chain
  cmdArgs?:     string[]
  deployments?: Deployments
}

export function populateDeployContext (
  deployment:  Deployment,
  deployAgent: Agent,
  clientAgent: Agent = deployAgent
): DeployContext {
  return {
    deployment,
    prefix: deployment.prefix,

    deployAgent,
    async deploy (template: Template, name: string, initMsg: Message) {
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

    clientAgent,
    getInstance (name: string) {
      return this.deployment.get(name)
    },
    getClient (Client, name) {
      return this.clientAgent.getClient(Client, this.deployment.get(name))
    }
  }
}

/** The part of OperationContext that deals with deploying
  * groups of contracts and keeping track of the receipts. */
export interface DeployContext {
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
  deploy:       (template: Template, name: string, initMsg: Message) => Promise<Instance>
  /** Shorthand for calling `deployment.initMany(deployAgent, ...)` */
  deployMany:   (template: Template, configs: [string, Message][]) => Promise<Instance[]>
  /** Who'll interact with existing contracts */
  clientAgent?: Agent
  /** Shorthand for calling `deployment.get(name)` */
  getInstance:  (name: string) => Instance
  /** Shorthand for calling `clientAgent.getClient(Client, deployment.get(name))` */
  getClient:    <C extends Client, O extends ClientOpts>(Client: ClientCtor<C, O>, name: string)=>C
}

/** Create a new deployment and add it to the command context. */
export async function createDeployment (
  context: {
    chain?:       Chain
    agent?:       Agent
    timestamp?:   string
    cmdArgs?:     string[]
    config?:      any
    deployments?: Deployments
  }
): Promise<typeof context> {
  Object.assign(context, await enableDeployments(context))
  const [ prefix = context.timestamp ] = context.cmdArgs
  await context.deployments.create(prefix)
  await context.deployments.select(prefix)
  return getDeployment(context)
}

export async function selectDeployment (context: (PopulateDeployments & {
  cmdArgs: string[]
})) {
  Object.assign(context, await enableDeployments(context))
  const { cmdArgs: [id] = [undefined] } = context
  const list = context.deployments.list()
  if (list.length < 1) {
    console.info('\nNo deployments. Create one with `deploy new`')
  }
  if (id) {
    console.info(bold(`Selecting deployment:`), id)
    await context.deployments.select(id)
  }
  if (list.length > 0) {
    console.info(bold(`Known deployments:`))
    for (let deployment of context.deployments.list()) {
      if (deployment === context.deployments.KEY) {
        continue
      }
      const count = Object.keys(context.deployments.get(deployment).receipts).length
      if (context.deployments.active && context.deployments.active.prefix === deployment) {
        deployment = `${bold(deployment)} (selected)`
      }
      deployment = `${deployment} (${count} contracts)`
      console.info(` `, deployment)
    }
  }
  console.log()
  context.deployments.printActive()
}

/** Add the currently active deployment to the command context. */
export async function getDeployment (
  context: (PopulateDeployments & {
    agent?: Agent
  })
): Promise<DeployContext> {
  Object.assign(context, await enableDeployments(context))
  const deployment = context.deployments.active
  if (!deployment) {
    console.error(join(bold('No selected deployment on chain:'), context.chain.id))
    process.exit(1)
  }
  const prefix = deployment.prefix
  let contracts: string|number = Object.values(deployment.receipts).length
  contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
  console.info(bold('Active deployment:'), prefix, contracts)
  print(console).deployment(deployment)
  return await populateDeployContext(deployment, context.agent)
}

/** Add either the active deployment, or a newly created one, to the command context. */
export async function getOrCreateDeployment (
  context: (PopulateDeployments & {
    run:       Function
    timestamp: string
    cmdArgs:   string[]
  })
) {
  Object.assign(context, await enableDeployments(context))
  if (context.deployments.active) {
    return getDeployment(context)
  } else {
    return await createDeployment(context)
  }
}

/** Print the status of a deployment. */
export async function showDeployment (
  context: (PopulateDeployments & {
    cmdArgs: string[]
  })
) {
  Object.assign(context, await enableDeployments(context))
  const { cmdArgs: [id] = [undefined] } = context
  let deployment = context.deployments.active
  if (id) {
    deployment = context.deployments.get(id)
  }
  if (!deployment) {
    console.error(join(bold('No selected deployment on chain:'), context.chain.id))
    process.exit(1)
  }
  print(console).deployment(deployment)
}

export class FadromaOps {

  /** Collection of registered commands. */
  commands: Commands = {}

  /** Register a command. */
  command (name: string, ...steps: Operation<any>[]) {
    // To each command, prepend a step that populates the global config.
    steps.unshift(async function loadConfiguration () {
      return { config: currentConfig, chains: this.chains }
    })

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

  /** Call this method with `import.meta.url` at the end of a module that contains commands.
    * If that module is the execution, entrypoint, runs a command from the command line.
    * TODO get rid of this and just use "fadroma run" + default exports */
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

  /** Run a command. */
  async run (...commands: string[]) {
    Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
    return await runCommands(this.commands, commands)
  }

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

export async function printChainStatus ({ chain }: { chain: Chain }) {
  if (!chain) {
    console.info('No active chain.')
  } else {
    console.info(bold('Chain type:'), chain.constructor.name)
    console.info(bold('Chain mode:'), chain.mode)
    console.info(bold('Chain ID:  '), chain.id)
    console.info(bold('Chain URL: '), chain.url.toString())
  }
}

export function parallel (...commands) {
  return function parallelCommands (context) {
    return Promise.all(commands.map(command=>context.run(command)))
  }
}

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

export type Operation<T> = (context: OperationContext) => Promise<T>

export async function getBaseOperationContext () {}

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
      // Bind every function in the context so that `this` points to the current context object.
      // This allows e.g. `deploy` to use the current value of `deployAgent`,
      // but may break custom bound functions when passing them through the context.
      Object.keys(context).forEach(key=>{
        if (context[key] instanceof Function) {
          context[key] = context[key].bind(context)
        }
      })
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

export class FadromaConfig {
  constructor (
    public readonly env: typeof process.env,
  ) {
    this.installScrt()
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

  private installScrt () {
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

export class CommandRunner {
  constructor (
    public readonly name:   string,
    public readonly before: Function[],
    public readonly after:  Function[]
  ) {}
  commands = {}
  add (name, info, steps) {
    this.commands[name] = { info, steps }
    return this
  }
  async main (url: string) {
    if (process.argv[1] === fileURLToPath(url)) {
      Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
      return await runCommands(this.commands, process.argv.slice[2]).then(()=>process.exit(0))
    } else {
      return this
    }
  }
}

export class DeployCommandRunner extends CommandRunner {
  constructor (
    public readonly name:   string,
    public readonly before: Function[] = [],
    public readonly after:  Function[] = []
  ) {
    super(name, [
      populateChain,
      populateAgent,
      enableScrtBuilder,
      enableFileUpload,
      enableDeployments,
      ...before
    ], [
      ...after,
      showDeployment
    ])
  }
  asNewDeployment (name, info, ...steps) {
    return this.add(name, info, [createDeployment, ...steps])
  }
  asCurrentDeployment (name, info, ...steps) {
    return this.add(name, info, [enableDeployments, ...steps])
  }
  /** For iterating on irreversible mutations. */
  asCurrentDeploymentIfNotOnDevnet (name, info, ...steps) {
    return this.add(name, info, [asNewDeploymentIfDevnet, ...steps])
    function asNewDeploymentIfDevnet (context) {
      if (context.chain.isDevnet) {
        return createDeployment(context)
      } else {
        return enableDeployments(context)
      }
    }
  }
}
