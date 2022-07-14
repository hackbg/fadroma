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
  Workspace,
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
    chain:        this.getStr( 'FADROMA_CHAIN',              ()=>''),
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
    if (this.project.chain) {
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
}

export const currentConfig = new FadromaConfig(process.env)

export interface Command {
  info:  string,
  steps: Step<unknown>[]
}

export type Step<U> = (context: Context) => U|Promise<U>

export type IntoSource   = Source|string
export type IntoArtifact = Artifact|Source|string
export type IntoTemplate = Template|Artifact|Source|string

export type Context = {
  /** Run a subroutine in a copy of the current context, i.e. without changing the context. */
  run <T> (
    operation:     Step<T>,
    extraContext?: Record<string, unknown>,
    ...extraArgs:  unknown[]
  ): Promise<T>
  /** Configuration of Fadroma. */
  config:      FadromaConfig
  /** Extra arguments passed from the command line. */
  cmdArgs:     string[]
  /** Start of command execution. */
  timestamp:   string
  /** Known block chains and connection methods. */
  chains:      typeof knownChains,
  /** The blockhain to connect to. */
  chain:       Chain,
  /** Collections of interlinked contracts on the active chain. */
  deployments: Deployments
  /** = chain.isMainnet */
  isMainnet:   boolean
  /** = chain.isTestnet */
  isTestnet:   boolean
  /** = chain.isDevnet */
  isDevnet:    boolean
  /** = chain.isMocknet */
  isMocknet:   boolean
  /** True if the chain is a devnet or mocknet */
  devMode:     boolean
  /** Default identity to use when operating on the chain. */
  agent:       Agent
  /** Knows how to build contracts for a target. */
  builder:     Builder
  /** Cargo workspace. */
  workspace:   Workspace
  /** Get a Source by crate name from the current workspace. */
  getSource:   (source: string) => Source
  /** Get a Source by crate name from the current workspace. */
  build:              (source:  IntoSource)   => Promise<Artifact>
  buildMany:          (sources: IntoSource[]) => Promise<Artifact[]>
  /** Knows how to upload contracts to a blockchain. */
  uploader:           Uploader
  upload:             (artifact:  IntoArtifact)   => Promise<Template>
  uploadMany:         (artifacts: IntoArtifact[]) => Promise<Template[]>
  buildAndUpload:     (source: Source|string   ) => Promise<Template>
  buildAndUploadMany: (sources: (Source|string)[]) => Promise<Template[]>
  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment
  /** Prefix to the labels of all deployed contracts.
    * Identifies which deployment they belong to. */
  prefix:       string
  /** Appended to contract labels in devnet deployments for faster iteration. */
  suffix?:      string
  /** Who'll deploy new contracts */
  deployAgent?: Agent
  /** Deploy a contract. */
  deploy:       (name: string, template: Template, initMsg: Message) => Promise<Instance>
  /** Deploy multiple contracts from the same template. */
  deployMany:   (template: Template, configs: [string, Message][]) => Promise<Instance[]>
  /** Who'll interact with existing contracts */
  clientAgent?: Agent
  /** Shorthand for calling `deployment.get(name)` */
  getInstance:  (name: string) => Instance
  /** Shorthand for calling `clientAgent.getClient(Client, deployment.get(name))` */
  getClient:    <C extends Client, O extends ClientOpts>(name: string, Client?: ClientCtor<C, O>)=>C
  /** Reproducibly obtain a template. */
  template <T extends Client> (artifact: IntoTemplate): TemplateSlot
  /** Idempotently deploy a contract. */
  contract <T extends Client> (name, _Client?: ClientCtor<T, any>): ContractSlot<T>
}

export interface TemplateSlot {
  get         (errOrfn?: string|((context: Partial<Context>)=>Template)): Promise<Template>
  getOrUpload (): Promise<Template>
  upload      (): Promise<Template>
}

export interface ContractSlot<T extends Client> {
  get         (errOrfn?: string|((context: Partial<Context>)=>T|Promise<T>)): Promise<T>
  getOrDeploy (code: string|Source|Template, initMsg: unknown):               Promise<T>
  deploy      (code: string|Source|Template, initMsg: unknown):               Promise<T>
}

export class Commands {
  constructor (
    public readonly name,
    public readonly before:   Step<unknown>[] = [],
    public readonly after:    Step<unknown>[] = [],
    public readonly commands: Record<string, Command> = {}
  ) {}
  command (name: string, info: string, ...steps: Step<unknown>[]) {
    // validate that all steps are functions
    for (const i in steps) {
      if (!(steps[i] instanceof Function)) {
        throw new Error(`${this.name} command ${name}: invalid step ${i} (not a Function)`)
      }
    }
    // store command
    this.commands[name] = { info, steps: [...this.before, ...steps, ...this.after] }
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
  /** For iterating on would-be irreversible mutations. */
  iteration (name, info, ...steps) {
    return this.command(name, info, deploymentIteration, ...steps)
    function deploymentIteration (context) {
      if (context.devMode) {
        return Deploy.create(context)
      } else {
        return context
      }
    }
  }
  /** `export default myCommands.main(import.meta.url)`
    * once per module after defining all commands */
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
          print(console).usage(this)
          process.exit(1)
        }
      }
    }, 0)
    return self
  }
  async run (args = process.argv.slice(2)): Promise<void> {
    if (args.length === 0) {
      print(console).usage(this)
      process.exit(1)
    }
    const command = this.parse(args)
    if (!command) {
      console.error('Invalid command', ...args)
      process.exit(1)
    }
    const [cmd, { info, steps }, cmdArgs] = command
    return await runOperation(cmd, info, steps, cmdArgs)
  }
}

export async function runSub <T> (
  operation:    Step<T>,
  extraContext: Record<string, any> = {},
  extraArgs:    unknown[]
): Promise<T> {
  if (!operation) {
    throw new Error('Tried to run missing operation.')
  }
  const params = Object.keys(extraContext)
  console.info(
    'Running operation', bold(operation.name||'(unnamed)'),
    ...((params.length > 0) ? ['with custom', bold(params.join(', '))] : [])
  )
  try {
    //@ts-ignore
    return await operation({ ...this, ...extraContext }, ...extraArgs)
  } catch (e) {
    throw e
  }
}

export async function runOperation (
  command,
  cmdInfo,
  cmdSteps,
  cmdArgs,

  // Establish context
  context: Partial<Context> = {
    cmdArgs,
    config:    currentConfig,
    timestamp: timestamp(),
  }
): Promise<void> {

  // Never hurts:
  Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)

  // Add step runner
  context.run = runSub.bind(context)

  // Will count milliseconds
  const stepTimings = []

  // Start of command
  const T0 = + new Date()

  // Will align output
  const longestName = cmdSteps.map(step=>step?.name||'').reduce((max,x)=>Math.max(max, x.length), 0)

  // Store thrown error and print report before it
  let error

  // Execute each step, updating the context
  for (const step of cmdSteps) {
    // Pad the name
    const name = (step.name||'').padEnd(longestName)

    // Start of step
    const T1 = + new Date()

    try {
      // Object returned by step gets merged into context.
      const updates = await step({ ...context })

      // On every step, the context is recreated from the old context and the updates.
      context = { ...context, ...updates }

      // Make sure `this` in every function of the context points to the up-to-date context.
      rebind(context)

      // End of step
      const T2 = + new Date()
      stepTimings.push([name, T2-T1, false])
    } catch (e) {
      // If the step threw an error, store the timing and stop executing new steps
      error = e
      break
    } finally {
      // End of step
      const T2 = + new Date()
      stepTimings.push([name, T2-T1, true])
    }
  }

  // Final execution report
  const T3 = + new Date()
  const result = error ? colors.red('failed') : colors.green('completed')
  console.info(`The command`, bold(command), result, `in`, ((T3-T0)/1000).toFixed(3), `s`)

  // Print timing of each step
  for (const [name, duration, isError] of stepTimings) {
    console.info(
      isError?`${colors.red('FAIL')}`:`${colors.green('OK  ')}`,
      bold((name||'(nameless step)').padEnd(40)),
      (duration/1000).toFixed(1).padStart(10),
      's'
    )
  }

  // If there was an error throw it now
  if (error) {
    throw error
  }
}

export function rebind (self, obj = self) {
  for (const key in obj) {
    if (obj[key] instanceof Function) {
      obj[key] = obj[key].bind(self)
    }
  }
}

/** Run several operations in parallel in the same context. */
export function parallel (...operations) {
  return function parallelOperations (context) {
    return Promise.all(operations.map(command=>context.run(command)))
  }
}

export async function getChain (
  { config, chains }, name = config.project.chain
): Promise<Partial<Context>> {

  config ??= currentConfig
  chains ??= knownChains

  // Check that a valid name is passed
  if (!name || !chains[name]) {
    console.error('Fadroma: pass a known chain name or set FADROMA_CHAIN env var.')
    console.info('Known chain names:')
    for (const chain of Object.keys(chains).sort()) {
      console.info(`  ${chain}`)
    }
    process.exit(1)
  }

  // Return chain and deployments handle
  const chain = await chains[name](config)
  return {
    chains,
    chain,
    deployments: Deployments.fromConfig(chain, config.project.root),
    devMode:     chain.isDevnet || chain.isMocknet,
    isDevnet:    chain.isDevnet,
    isMocknet:   chain.isMocknet,
    isTestnet:   chain.isTestnet,
    isMainnet:   chain.isMainnet,
  }

}

export const knownChains = {
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

export async function resetDevnet ({ chain }: { chain: Chain }) {
  if (!chain) {
    console.info('No active chain.')
  } else if (!chain.isDevnet) {
    console.info('This command is only valid for devnets.')
  } else {
    await chain.node.terminate()
  }
}

export async function getAgent ({ config, chain }: Partial<Context>): Promise<Partial<Context>> {
  config ??= currentConfig
  const agentOpts: AgentOpts = { name: undefined }
  if (chain.isDevnet) {
    // for devnet, use auto-created genesis account
    agentOpts.name = 'ADMIN'
  } else if ((chain as any).isSecretNetwork) {
    // for scrt-based chains, use mnemonic from config
    agentOpts.mnemonic = config.scrt.agent.mnemonic
  }
  const agent = await chain.getAgent(agentOpts)
  return {
    agent
  }
}

export class Deploy extends Commands {
  constructor (name, before, after) {
    super(name, before, after)
    this.before.push(print(console).chainStatus)
    this.command('reset',  'reset the devnet',                resetDevnet)
    this.command('list',   'print a list of all deployments', Deploy.list)
    this.command('select', 'select a new active deployment',  Deploy.select)
    this.command('new',    'create a new empty deployment',   Deploy.create)
    this.command('status', 'show the current deployment',     Deploy.show)
  }

  static list = async function listDeployments ({ chain, deployments }: Partial<Context>): Promise<void> {
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

  /** Print the status of a deployment. */
  static show = async function showDeployment (
    context: Partial<Context>,
    id = context.cmdArgs[0]
  ): Promise<void> {
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

  static select = async function selectDeployment (
    context: Partial<Context>
  ): Promise<void> {
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
      this.list(context)
    }
    if (deployments.active) {
      console.info(`Currently selected deployment:`, bold(deployments.active.prefix))
    } else {
      console.info(`No selected deployment.`)
    }
  }

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async function getOrCreateDeployment (
    context: Partial<Context>
  ): Promise<Partial<Context>> {
    if (context.deployments.active) {
      return this.get(context)
    } else {
      return await this.create(context)
    }
  }

  /** Create a new deployment and add it to the command context. */
  static create = async function createDeployment (
    context: Partial<Context>
  ): Promise<Partial<Context>> {
    const [ prefix = context.timestamp ] = context.cmdArgs
    await context.deployments.create(prefix)
    await context.deployments.select(prefix)
    return await this.get(context)
  }

  /** Add the currently active deployment to the command context. */
  static get = async function getDeployment (
    context: Partial<Context>
  ): Promise<Partial<Context>> {
    if (!context.deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
    context.deployment = context.deployments.active
    return await getDeployContext(context)
  }

}

export function getDeployContext (context: Partial<Context>): Partial<Context> {

  const {
    timestamp,
    deployment,
    agent,
    deployAgent = agent,
    clientAgent = agent,
    suffix      = `+${timestamp}`
  } = context

  type Fn<T, U> = (...t: T[]) => U
  function needsActiveDeployment <T, U> (fn: Fn<T, U>): Fn<T, U> {
    if (!deployment) return () => { throw new Error('Fadroma Ops: no active deployment') }
    return fn
  }

  return {

    template (code: IntoTemplate) {
    },

    deployment,
    clientAgent: agent,
    contract: needsActiveDeployment(function contract <C extends Client> (
      instance:  string|{ address: string },
      APIClient: ClientCtor<C, any>
    ) {
      // By default, contracts are returned as the base Client class.
      // Caller can pass a specific API class constructor as 2nd arg.
      APIClient = APIClient ?? Client as typeof APIClient
      let client = null

      // When 1st arg is string, look for contract by name in deployment
      if (typeof instance === 'string') {
        const name = instance
        if (this.deployment.has(name)) {
          console.info('Found contract:', bold(name))
          client = this.clientAgent.getClient(APIClient, this.deployment.get(name))
        }
        // Return an object with 3 methods bound to the containing context.
        // (i.e. with access to `deployment`, `buildAndUpload`, etc. via `this`)
        return rebind(this, { get, getOrDeploy, deploy })

        // Get the specified contract. If it's not in the deployment,
        // try fetching it from a subroutine or throw an error with a custom message.
        async function get (errOrFn: string|((context: Partial<Context>)=>C) = ''): Promise<C> {
          if (client) return client
          if (errOrFn instanceof Function) {
            console.info('Looking for contract:', bold(instance as string))
            client = await Promise.resolve(errOrFn(context))
            if (client) return client
            throw new Error(`No such contract: ${name}.`)
          } else {
            errOrFn = `No such contract: ${name}. ${errOrFn||''}`
            throw new Error(errOrFn)
          }
        }

        // If the contract was found in the deployment, return it.
        // Otherwise, deploy it under the specified name.
        async function getOrDeploy (code: string|Source|Template, initMsg: unknown): Promise<C> {
          if (client) return client
          return this.deploy(code, initMsg)
        }

        // Always deploy the specified contract. If a contract with the same name
        // already exists in the deployment, it will fail - use suffixes
        async function deploy (code: IntoTemplate, initMsg: unknown): Promise<C> {
          console.info(`Deploying contract:`, bold(name))
          if (typeof code === 'string' || code instanceof Source) {
            code = await this.buildAndUpload(code)
            const instance = await this.deployment.init(this.deployAgent, code, name, initMsg)
            return this.clientAgent.getClient(APIClient, instance)
          }
        }

      } else if (instance.address) {

        // When 1st instance has `address` property, just get client by address.
        console.info('Using contract:', bold(instance.address))
        return this.clientAgent.getClient(APIClient, instance)

      } else {
        throw new Error('Fadroma: invalid contract() invocation')
      }

    }),

    suffix,
    getInstance (name: string) {
      return this.deployment.get(name)
    },
    getClient (name: string, _Client: typeof Client = Client) {
      return this.clientAgent.getClient(Client, this.deployment.get(name))
    },
    deployAgent,
    async deployMany (template: Template, configs: [string, Message][]) {
      if (!this.deployAgent) {
        throw new Error('Fadroma Ops: no deployAgent in context')
      }
      return await this.deployment.initMany(this.deployAgent, template, configs)
    },

  }

}

export function getBuildContext ({ config }: {
  config: {
    project: { root:    string  }
    build:   { rebuild: boolean }
    scrt:    { build:   object  }
  }
}): Promise<Partial<Context>> {
  const builder = getScrtBuilder({ ...config.build, ...config.scrt.build })
  const workspace = new Workspace(config.project.root)
  return {
    builder,
    workspace,
    getSource (source: IntoSource): Source {
      if (typeof source === 'string') return this.workspace.crate(source)
      return source
    },
    async build (source: IntoSource): Promise<Artifact> {
      return await this.builder.build(this.getSource(source))
    },
    async buildMany (ref?: string, ...sources: IntoSource[][]): Promise<Artifact[]> {
      sources = [sources.reduce((s1, s2)=>[...new Set([...s1, ...s2])], [])]
      return await this.builder.buildMany(sources[0].map(source=>this.getSource(source)))
    }
  }
}

/** Add an uploader to the command context. */
export function getUploadContext (context: {
  agent:    Agent
  caching?: boolean
  config:   { project: { root: string }, upload: { reupload: boolean } },
} & Partial<Context>): Partial<Context> {
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
    async upload (artifact: Artifact|Source|string): Promise<Template> {
      return await uploader.upload(artifact)
    },
    async uploadMany (artifacts: [Artifact|Source|string][]): Promise<Template[]> {
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

/** The part of Context that deals with uploading
  * contract code to the platform. */
export interface UploadContext {
}

export const print = console => {
  const print = {

    // Usage of Command API
    usage ({ name, commands }: Commands) {
      let longest = 0
      for (const name of Object.keys(commands)) {
        longest = Math.max(name.length, longest)
      }
      console.log()
      for (const [name, { info }] of Object.entries(commands)) {
        console.log(`    ... ${name} ${bold(name.padEnd(longest))}  ${info}`)
      }
      console.log()
    },

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
      console.info('\nAvailable identities:')
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
