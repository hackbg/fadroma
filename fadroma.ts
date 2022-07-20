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
import { homedir } from 'os'
import { fileURLToPath } from 'url'

import $ from '@hackbg/kabinet'

export * from '@hackbg/konzola'
import {
  Console,
  bold,
  colors,
  timestamp
} from '@hackbg/konzola'

export * from '@hackbg/komandi'
import {
  getFromEnv,
  Commands,
  CommandContext
} from '@hackbg/komandi'

export * from '@fadroma/client'
import {
  Address,
  Agent,
  AgentOpts,
  Artifact,
  Chain,
  ChainMode,
  Client,
  ClientCtor,
  ClientOpts,
  Instance,
  Message,
  Template,
} from '@fadroma/client'

export * from '@fadroma/scrt'
import {
  ScrtConfig,
  getScrtConfig,
  ScrtGrpc
} from '@fadroma/scrt'

export * from '@fadroma/scrt-amino'
import {
  ScrtAmino
} from '@fadroma/scrt-amino'

export * from '@fadroma/build'
import {
  BuilderConfig,
  getBuilderConfig,
  getBuilder,
  Builder,
  Source,
  Workspace
} from '@fadroma/build'

import {
  DevnetConfig,
  getDevnetConfig,
  getDevnet
} from '@fadroma/devnet'

export * from '@fadroma/mocknet'
import {
  Mocknet
} from '@fadroma/mocknet'

export * from '@fadroma/deploy'
import {
  Uploader,
  FSUploader,
  CachingFSUploader,
  Deployments,
  Deployment
} from '@fadroma/deploy'

/** Update `process.env` with value from `.env` file */
import dotenv from 'dotenv'
dotenv.config()

//@ts-ignore
export const __dirname = dirname(fileURLToPath(import.meta.url))

/// # Reexport the core platform vocabulary:

export * from '@hackbg/kabinet'
export * from '@hackbg/formati'
export * from '@fadroma/client'
export * from '@fadroma/tokens'

/// # Define the top-level conventions and idioms:

export const console = Console('Fadroma')

export interface FadromaConfig {
  build:  BuilderConfig
  devnet: DevnetConfig
  scrt:   ScrtConfig
  /** Project settings. */
  project: {
    /** The project's root directory. */
    root:       string
    /** The selected chain backend. */
    chain:      string|null
  }
  /** System settings. */
  system: {
    /** The user's home directory. */
    homeDir:    string
    /** Address of Docker socket to use. */
    dockerHost: string
  }
  /** Upload settings. */
  upload: {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload:   boolean
  }
}

export function getConfig (cwd: string, env: Record<string, string> = {}): FadromaConfig {
  const { Str, Bool } = getFromEnv(env)
  const config = {
    build:        getBuilderConfig(cwd, env),
    devnet:       getDevnetConfig(cwd, env),
    scrt:         getScrtConfig(cwd, env),
    project: {
      root:       Str('FADROMA_PROJECT', ()=>cwd),
      chain:      Str('FADROMA_CHAIN', ()=>'')
    },
    system: {
      homeDir:    Str('HOME', ()=>homedir()),
      dockerHost: Str('DOCKER_HOST', ()=>'/var/run/docker.sock')
    },
    upload: {
      reupload:   Bool('FADRPOMA_REUPLOAD', ()=>false)
    }
  }
  validateScrtConfig()
  return config

  function validateScrtConfig () {
    const { project: { chain }, scrt } = config
    if (chain.includes('Scrt')) {
      if (chain.endsWith('Legacy')) {
        if (chain.includes('Mainnet') && !scrt.mainnet.apiUrl) throw new Error('set SCRT_MAINNET_API_URL')
        if (chain.includes('Testnet') && !scrt.testnet.apiUrl) throw new Error('set SCRT_TESTNET_API_URL')
      } else {
        scrt.mainnet.apiUrl ??= 'https://secret-4.api.trivium.network:9091'
        scrt.testnet.apiUrl ??= 'https://testnet-web-rpc.roninventures.io'
      }
    }
  }
}

export const currentConfig: FadromaConfig = getConfig(process.cwd(), process.env)

export type IntoSource   = Source|string
export type IntoArtifact = Artifact|IntoSource
export interface BuildContext extends CommandContext {
  /** Configuration of Fadroma. */
  config:       FadromaConfig
  /** Cargo workspace. */
  workspace:    Workspace
  /** Get a Source by crate name from the current workspace. */
  getSource:    (source: IntoSource) => Source
  /** Knows how to build contracts for a target. */
  builder:      Builder
  /** Get a Source by crate name from the current workspace. */
  build:        (source: IntoArtifact, ref?: string)         => Promise<Artifact>
  buildMany:    (ref?: string, ...sources: IntoArtifact[][]) => Promise<Artifact[]>
}

export type IntoTemplate = Template|IntoArtifact
export interface DeployContext extends BuildContext {
  /** Known block chains and connection methods. */
  chains:       typeof knownChains,
  /** The blockhain to connect to. */
  chain:        Chain,
  /** Collections of interlinked contracts on the active chain. */
  deployments:  Deployments
  /** = chain.isMainnet */
  isMainnet:    boolean
  /** = chain.isTestnet */
  isTestnet:    boolean
  /** = chain.isDevnet */
  isDevnet:     boolean
  /** = chain.isMocknet */
  isMocknet:    boolean
  /** True if the chain is a devnet or mocknet */
  devMode:      boolean
  /** Default identity to use when operating on the chain. */
  agent:        Agent
  /** Get an object representing a dependency on a template (code id + hash),
    * i.e. it can expect it to be there or upload it if it's not there. */
  template      (source: IntoTemplate): TemplateSlot
  /** Get an object representing a template (code id + hash)
    * or upload the template from source if it's not already uploaded. */
  getOrUploadTemplate (source: IntoTemplate): Promise<Template>
  /** Upload a template, cache receipt under `receipts/$CHAIN/uploads`. */
  upload:       (artifact:  IntoTemplate)   => Promise<Template>
  /** Upload multiple templates, cache receipts under `receipts/$CHAIN/uploads`. */
  uploadMany:   (artifacts: IntoTemplate[]) => Promise<Template[]>
  /** Knows how to upload contracts to a blockchain. */
  uploader:     Uploader
  /** Optional global suffix of all smart contracts deployed.
    * Useful for discerning multiple instanCan be usedces or versions of a contract. */
  suffix?:      string
  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment
  /** Shorthand for calling `deployment.get(name)` */
  getInstance (name: string): Instance
  /** Who'll deploy new contracts */
  deployer?: Agent
  /** Deploy a contract. */
  deploy <C extends Client, O extends ClientOpts> (
    name: string, template: IntoTemplate, initMsg: Message, APIClient?: ClientCtor<C, O>
  ): Promise<C>
  /** Deploy multiple contracts from the same template. */
  deployMany <C extends Client, O extends ClientOpts> (
    template: IntoTemplate, configs: [string, Message][], APIClient?: ClientCtor<C, O>
  ): Promise<C[]>
  /** Shorthand for calling `agent.getClient(Client, deployment.get(name))` */
  getClient <C extends Client, O extends ClientOpts> (name: string, Client?: ClientCtor<C, O>): C
  /** Get an object representing a dependency on a smart contract instance,
    * i.e. it can expect it to be there or deploy it if it's not there. */
  contract <C extends Client, O extends ClientOpts> (
    name: string, APIClient?: ClientCtor<C, O>
  ): ContractSlot<C>
  /** Get a client interface to a contract. */
  getContract <C extends Client> (
    reference:  string|{ address: string }, APIClient?: ClientCtor<C, any>,
  ): Promise<C|null>
  /** Get a contract or fail with a user-defined message. */
  getContract <C extends Client> (
    reference:  string|{ address: string }, APIClient?: ClientCtor<C, any>, msgOrFn?: InfoOrStep<any, C>,
  ): Promise<C>
  /** Get a contract or deploy it. */
  getOrDeployContract <C extends Client> (
    name: string, template: IntoTemplate, initMsg: Message, APIClient?: ClientCtor<C, any>
  ): Promise<C>
  /** Deploy a contract and fail if name already taken. */
  deployContract <C extends Client> (
    name: string, template: IntoTemplate, initMsg: Message, APIClient?: ClientCtor<C, any>
  ): Promise<C>
}

export type Context = DeployContext

export async function getChain (
  { config = currentConfig, chains }: Context, name = config?.project?.chain
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
    config,
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
  async 'Mocknet'          (config = currentConfig) {
    return new Mocknet()
  },
  async 'ScrtAminoMainnet' (config = currentConfig) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new ScrtAmino(id, { url, mode })
  },
  async 'ScrtAminoTestnet' (config = currentConfig) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new ScrtAmino(id, { url, mode })
  },
  async 'ScrtAminoDevnet'  (config = currentConfig) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.2').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtAmino(id, { url, mode, node })
  },
  async 'ScrtGrpcMainnet'  (config = currentConfig) {
    const mode = ChainMode.Mainnet
    const id   = config.scrt.mainnet.chainId
    const url  = config.scrt.mainnet.apiUrl
    return new ScrtGrpc(id, { url, mode })
  },
  async 'ScrtGrpcTestnet'  (config = currentConfig) {
    const mode = ChainMode.Testnet
    const id   = config.scrt.testnet.chainId
    const url  = config.scrt.testnet.apiUrl
    return new ScrtGrpc(id, { url, mode })
  },
  async 'ScrtGrpcDevnet'   (config = currentConfig) {
    const mode = ChainMode.Devnet
    const node = await getDevnet('scrt_1.3').respawn()
    const id   = node.chainId
    const url  = node.url.toString()
    return new ScrtGrpc(id, { url, mode, node })
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

export class Deploy extends Commands<DeployContext> {
  constructor (name, before, after) {
    super(name, before, after)
    this.before.push(print(console).chainStatus)
    this.command('reset',   'reset the devnet',                resetDevnet)
    this.command('list',    'print a list of all deployments', Deploy.list)
    this.command('select',  'select a new active deployment',  Deploy.select)
    this.command('new',     'create a new empty deployment',   Deploy.create)
    this.command('status',  'show the current deployment',     Deploy.show)
    this.command('nothing', 'check that the script runs', () => console.log('So far so good'))
  }

  /** Create a new deployment and add it to the command context. */
  static create = async function createDeployment (
    context: Partial<Context>
  ): Promise<Partial<Context>> {
    const [ prefix = context.timestamp ] = context.cmdArgs
    await context.deployments.create(prefix)
    await context.deployments.select(prefix)
    return await Deploy.get(context)
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

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async function getOrCreateDeployment (
    context: Partial<Context>
  ): Promise<Partial<Context>> {
    if (context.deployments.active) {
      return Deploy.get(context)
    } else {
      return await Deploy.create(context)
    }
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
      Deploy.list(context)
    }
    if (deployments.active) {
      console.info(`Currently selected deployment:`, bold(deployments.active.prefix))
    } else {
      console.info(`No selected deployment.`)
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

}

/** Error message or recovery function. */
export type InfoOrStep<C extends Context, T> = string|((context: Partial<C>)=>T)

export abstract class Slot<C extends Context, T> {
  abstract get (msgOrFn: InfoOrStep<C, T>): Promise<T>
  value: T|null = null
}

export function getBuildContext ({ config = currentConfig }: any = {}): Partial<Context> {
  let {
    project: { root = process.cwd() } = {},
    build = {},
    scrt: { build: scrtBuild = {} } = {}
  } = config || {}
  // Apply SecretNetwork-specific build vars on top of global build vars.
  // TODO select builder implementation here
  const builder   = getBuilder({ ...build, ...scrtBuild })
  const workspace = new Workspace(root)
  return {
    builder,
    workspace,
    getSource (source: IntoSource, ref?: string): Source {
      let workspace = this.workspace
      if (ref) workspace = workspace.at(ref)
      if (typeof source === 'string') return this.workspace.crate(source)
      return source
    },
    async build (source: IntoSource, ref?: string): Promise<Artifact> {
      return await this.builder.build(this.getSource(source).at(ref))
    },
    async buildMany (ref?: string, ...sources: IntoArtifact[][]): Promise<Artifact[]> {
      sources = [sources.reduce((s1, s2)=>[...new Set([...s1, ...s2])], [])]
      return await this.builder.buildMany(sources[0].map(source=>this.getSource(source)))
    }
  }
}

/** Add an uploader to the command context. */
export function getUploadContext ({
  config,
  agent: { chain: { isMocknet } },
  agent,
  caching = !config.upload.reupload,
  build,
  buildMany,
  workspace
}: Partial<Context> & {
  caching?:  boolean
}): Partial<Context> {

  const uploader = (!isMocknet && caching)
    ? CachingFSUploader.fromConfig(agent, config.project.root)
    : new FSUploader(agent)

  return {

    uploader,

    async upload (code: IntoTemplate): Promise<Template> {
      if (code instanceof Template) {
        return code
      }
      if (typeof code === 'string') {
        code = this.workspace.crate(code) as Source
        if (!this.build) throw new Error(`Upload ${code}: building is not enabled`)
        code = await this.build(code) as Artifact
      } else {
        const { url, codeHash, source } = code as Artifact
        code = new Artifact(url, codeHash, source)
      }
      const rel = bold($((code as Artifact).url).shortPath)
      console.info(`Upload ${bold(rel)}: hash`, bold(code.codeHash))
      code = await uploader.upload(code as Artifact) as Template
      console.info(`Upload ${bold(rel)}: id  `, bold(code.codeId),)
      return code
      throw Object.assign(
        new Error(`Fadroma: can't upload ${code}: must be crate name, Source, Artifact, or Template`),
        { code }
      )
    },

    async uploadMany (code: IntoTemplate[]): Promise<Template[]> {
      const templates = []
      for (const contract of code) {
        templates.push(await this.upload(contract))
      }
      return templates
    },

    template (code: IntoTemplate): TemplateSlot {
      return new TemplateSlot(this, code)
    },

    async getOrUploadTemplate (code: IntoTemplate): Promise<Template> {
      return await new TemplateSlot(this, code).getOrUpload()
    }

  }
}

export class TemplateSlot extends Slot<Context, Template> {
  constructor (
    public readonly context: Partial<Context>,
    public readonly code:    IntoTemplate,
  ) {
    super()
  }
  async get (msgOrFn: InfoOrStep<Context, Template> = ''): Promise<Template> {
    if (this.value) return this.value
    if (msgOrFn instanceof Function) {
      console.info('Looking for template', this.code)
      this.value = await Promise.resolve(msgOrFn(this.context))
      if (this.value) return this.value
      throw Object.assign(new Error(`No such template`), { code: this.code })
    } else {
      msgOrFn = `No such template.${msgOrFn||''}`
      throw new Error(msgOrFn)
    }
  }
  /** If the contract was found in the deployment, return it.
    * Otherwise, deploy it under the specified name. */
  async getOrUpload (): Promise<Template> {
    if (this.value) return this.value
    return await this.upload()
  }
  async upload () {
    return await this.context.upload(this.code)
  }
}

export function getDeployContext ({
  timestamp,
  deployment,
  agent,
  deployer = agent,
  suffix   = `+${timestamp}`
}: Partial<Context>): Partial<Context> {

  type Fn<T, U> = (...t: T[]) => U
  function needsActiveDeployment <T, U> (fn: Fn<T, U>): Fn<T, U> {
    if (!deployment) return () => { throw new Error('Fadroma Ops: no active deployment') }
    return fn
  }

  return {
    deployment,
    suffix,
    deployer,
    contract <C extends Client> (
      instance:  string|{ address: string },
      APIClient: ClientCtor<C, any>
    ): ContractSlot<C> {
      return new ContractSlot(this, instance, APIClient)
    },
    getInstance (name: string) {
      return this.deployment.get(name)
    },
    async getContract <C extends Client> (
      reference: string|{ address: string },
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
      msgOrFn?:  InfoOrStep<any, C>
    ): Promise<C> {
      return await new ContractSlot(this, reference, APIClient).get(msgOrFn)
    },
    async getOrDeployContract <C extends Client> (
      name:      string,
      template:  IntoTemplate,
      initMsg:   Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).getOrDeploy(template, initMsg)
    },
    async deployContract <C extends Client> (
      name:      string,
      template:  IntoTemplate,
      initMsg:   Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).deploy(template, initMsg)
    },
    async deployMany <C extends Client> (
      template:  IntoTemplate,
      configs:   [string, Message][],
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>
    ) {
      template = await this.upload(template) as Template
      try {
        return await this.deployment.initMany(this.deployer, template, configs)
      } catch (e) {
        console.error(`Deploy of multiple contracts failed: ${e.message}`)
        console.error(`Deploy of multiple contracts failed: Configs were:`)
        console.log(JSON.stringify(configs, null, 2))
        throw e
      }
    },
  }

}

/** Object returned by context.contract() helper.
  * `getOrDeploy` method enables resumable deployments. */
export class ContractSlot<C extends Client> extends Slot<Context, C> {
  constructor (
    public readonly context:   Partial<DeployContext>,
    public readonly reference: string|{ address: Address },
    /** By default, contracts are returned as the base Client class.
      * Caller can pass a specific API class constructor as 2nd arg. */
    public readonly APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>
  ) {
    super()
    if (typeof reference === 'string') {
      // When arg is string, look for contract by name in deployment
      if (this.context.deployment.has(reference)) {
        console.info('Found contract:', bold(reference))
        this.value = this.context.deployer.getClient(
          this.APIClient,
          this.context.deployment.get(reference)
        )
      }
    } else if (reference.address) {
      // When arg has `address` property, just get client by address.
      this.value = this.context.deployer.getClient(APIClient, reference)
    }
  }
  /** Get the specified contract. If it's not in the deployment,
    * try fetching it from a subroutine or throw an error with a custom message. */
  async get (msgOrFn: InfoOrStep<any, C> = ''): Promise<C> {
    if (this.value) return this.value
    if (msgOrFn instanceof Function) {
      console.info('Finding contract:', bold(this.reference as string))
      this.value = await Promise.resolve(msgOrFn(this.context))
      if (this.value) return this.value
      throw new Error(`No such contract: ${this.reference}.`)
    } else {
      msgOrFn = `No such contract: ${this.reference}. ${msgOrFn||''}`
      throw new Error(msgOrFn)
    }
  }
  /** If the contract was found in the deployment, return it.
    * Otherwise, deploy it under the specified name. */
  async getOrDeploy (code: IntoTemplate, init: Message): Promise<C> {
    if (this.value) return this.value
    return await this.deploy(code, init)
  }
  /** Always deploy the specified contract. If a contract with the same name
    * already exists in the deployment, it will fail - use suffixes */
  async deploy (code: IntoTemplate, init: Message): Promise<C> {
    const name     = this.reference as string
    const template = await this.context.upload(code)
    console.info(`Deploy ${bold(name)}:`, 'from code id:', bold(template.codeId))
    try {
      const instance = await this.context.deployment.init(this.context.deployer, template, name, init)
      return this.context.deployer.getClient(this.APIClient, instance) as C
    } catch (e) {
      console.error(`Deploy ${bold(name)}: Failed: ${e.message}`)
      console.error(`Deploy ${bold(name)}: Failed: Init message was:`)
      console.log(JSON.stringify(init, null, 2))
      throw e
    }
  }
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
