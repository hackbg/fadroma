import { timestamp } from '@hackbg/konzola'
import { CommandContext } from '@hackbg/komandi'
import { hide } from './client-fields'
import type { Class, Overridable } from './client-fields'
import { ClientError, ClientConsole } from './client-events'
import type { Agent, Chain, Message } from './client-connect'
import { Contract, Contracts, ContractTemplate, ContractInstance, fetchCodeHash, getSourceSpecifier } from './client-contract'
import type { ContractSource, Client, CodeHash, CodeId, Name } from './client-contract'

export type DeploymentState = Record<string, Partial<ContractInstance>>

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment extends CommandContext {
  log = new ClientConsole('Fadroma.Deployment')

  constructor (options: Partial<Deployment> & any = {}) {
    super(options.name ?? 'Deployment')
    this.name      = options.name         ?? this.name
    this.state     = options.state        ?? this.state
    this.agent     = options.agent        ?? this.agent
    this.chain     = options.agent?.chain ?? options.chain ?? this.chain
    this.builder   = options.builder      ?? this.builder
    this.uploader  = options.uploader     ?? this.uploader
    this.workspace = options.workspace    ?? this.workspace
    this.revision  = options.revision     ?? this.revision

    this.log.name = this.name ?? this.log.name

    hide(this, [
      'log', 'state', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ])

    this
      .addCommand('build',  'build all required contracts',
                  this.buildMany.bind(this))
      .addCommand('upload', 'upload all required contracts',
                  this.uploadMany.bind(this))
      .addCommand('status', 'show the status of this deployment',
                  this.showStatus.bind(this))
  }

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name: string = timestamp()
  /** Mapping of names to contract instances. */
  state: DeploymentState = {}
  /** Number of contracts in deployment. */
  get size () { return Object.keys(this.state).length }

  /** Default Git ref from which contracts will be built if needed. */
  repository?: string = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?: string = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?: string = 'HEAD'
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?: Builder

  async showStatus () {
    this.log.deployment(this)
  }

  /** Build multiple contracts. */
  async buildMany (contracts: (string|ContractSource)[]): Promise<ContractSource[]> {
    return this.task(`build ${contracts.length} contracts`, async () => {
      if (!this.builder) throw new ClientError.NoBuilder()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts.map(contract=>{
        if (typeof contract === 'string') {
          return this.contract({ crate: contract }) as ContractSource
        } else {
          return contract
        }
      })
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      const sources = (contracts as ContractTemplate[])
        .map(contract=>`${contract.crate}@${contract.revision}`)
        .join(', ')
      return this.task(`build ${count} ${sources}`, () => {
        if (!this.builder) throw new ClientError.NoBuilder()
        return this.builder.buildMany(contracts as ContractSource[])
      })
    })
  }

  /** Agent to use when deploying contracts. */
  agent?: Agent
  /** Chain on which operations are executed. */
  chain?: Chain
  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean { return this.chain?.devMode   ?? false }
  /** = chain.isMainnet */
  get isMainnet (): boolean { return this.chain?.isMainnet ?? false }
  /** = chain.isTestnet */
  get isTestnet (): boolean { return this.chain?.isTestnet ?? false }
  /** = chain.isDevnet */
  get isDevnet  (): boolean { return this.chain?.isDevnet  ?? false }
  /** = chain.isMocknet */
  get isMocknet (): boolean { return this.chain?.isMocknet ?? false }

  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:   Uploader

  /** Upload multiple contracts to the chain.
    * @returns the same contracts, but with `chainId`, `codeId` and `codeHash` populated. */
  async uploadMany (contracts: ContractSource[]): Promise<ContractTemplate[]> {
    return this.task(`upload ${contracts.length} contracts`, async () => {
      if (!this.uploader) throw new ClientError.NoUploader()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts
        .map(contract=>(typeof contract === 'string')?this.contract({ crate: contract }):contract)
        .map(contract=>contract.asSource)
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      return this.task(`upload ${count} artifacts`, () => {
        if (!this.uploader) throw new ClientError.NoUploader()
        return this.uploader.uploadMany(contracts)
      })
    })
  }

  /** Specify a contract with optional client class and metadata.
    * @returns a Contract instance with the specified parameters.
    *
    * When defined as part of a Deployment, the methods of the Contract instance
    * are lazy and only execute when awaited:
    *
    * @example
    *   class ADeployment {
    *     aContract = this.contract({...}).deploy()
    *     bContract = this.contract({...}).deploy(async()=>({ init: await this.aContract.address }))
    *   }
    *   const aDeployment = new ADeployment() // nothing happens yet
    *   await aDeployment.bContract // bContract in deployed and pulls in aContract
    *   await aDeployment.aContract // aContract is now also resolved
    *
    * Use the methods of the returned Contract instance
    * to define what is to be done with the contract:
    *
    * @example
    *   // This will either return a Client to ExternalContract,
    *   // or bail if ExternalContract is not in the deployment:
    *   await this.contract({ name: 'ExternalContract' })
    *
    * @example
    *   // This will only deploy OwnContract if it's not already in the deployment.
    *   // Otherwise it will return a Client to the existing instance.
    *   await this.contract({ name: 'OwnContract' }).deploy(init?, callback?)
    *
    * @example
    *   // This will deploy multiple instances of the same contract,
    *   // returning an array of Client instances.
    *   await this.contract({ name: 'OwnContract' }).deployMany(inits?)
    *
    * @example
    *   // This will upload the contract code but not instantiate it,
    *   // and will therefore return a Contract.
    *   await this.contract({ name: 'OwnContractTemplate' }).upload()
    *
    **/
  contract <C extends Client> (options: Partial<Contract<C>> = {}): Contract<C> {
    // If a contract with this name exists in the deploymemt,
    // inherit properties from it. TODO just return the same contract
    return new Contract<C>({
      ...options,
      ...(options.name && this.has(options.name)) ? this.get(options.name) : {}
    }).attach(this)
  }

  /** Specify multiple contracts.
    * @returns an array of Contract instances matching the specified predicate. */
  contracts <C extends Client> (options: Partial<Contracts<C>>): Contracts<C> {
    return new Contracts<C>({...options}).attach(this)
  }

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.state[name]
  }
  /** Throw if a certain contract is not found in the records. */
  expect (name: string, message?: string): Contract<any> {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return this.contract({...receipt, name})
    throw new ClientError(message)
  }
  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Partial<Contract<any>>|null {
    const receipt = this.state[name]
    if (!receipt) return null
    return { ...receipt, context: this }
  }
  /** Chainable. Add entry to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.state[name] || {}, ...data, name })
  }
  /** Chainable. Add entry to deployment, replacing existing receipt. */
  set (name: string, data: Partial<Client> & any): this {
    this.state[name] = { name, ...data }
    this.save()
    return this
  }
  /** Chainable. Add multiple entries to the deployment, replacing existing receipts. */
  setMany (receipts: Record<string, any>): this {
    for (const [name, receipt] of Object.entries(receipts)) this.state[name] = receipt
    this.save()
    return this
  }
  /** Overridden by Deployer subclass in @fadroma/deploy
    * to allow saving deployment data to the DeployStore. */
  save () { /*nop*/ }

  /** Create an instance of `new ctor(this, ...args)` and attach it
    * to the command tree under `name`, with usage description `info`.
    * See the documentation of `interface Subsystem` for more info.
    * @returns an instance of `ctor` */
  subsystem <X extends Deployment>(
    name: string,
    info: string,
    ctor: Subsystem<X, typeof this>,
    ...args: unknown[]
  ): X {
    return this.attach(new ctor(this, ...args) as X, name, info)
  }

  attach <X extends Deployment> (
    inst: X,
    name: string = inst.constructor.name,
    info: string = `(undocumented)`,
  ) {
    const context = this
    Object.defineProperty(inst, 'name', {
      enumerable: true,
      get () { return context.name }
    })
    Object.defineProperty(inst, 'state', {
      get () { return context.state }
    })
    Object.defineProperty(inst, 'save', {
      get () { return context.save.bind(context) }
    })
    this.addCommands(name, info, inst as any) // TODO
    return inst
  }

  get [Symbol.toStringTag]() { return `${this.name??'-'}` }

}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts),
  * and whose constructor takes a Deployer as first argument, as well as any number of
  * other arguments. This interface can be used to connect the main project class to individual
  * deployer classes for different parts of the project, enabling them to operate in the same
  * context (chain, agent, builder, uploader, etc). */
export interface Subsystem<D extends Deployment, E extends Deployment> extends Class<D, [
  E, ...unknown[]
]> {}

export class VersionedDeployment<V> extends Deployment {
  constructor (
    options: object = {},
    public version: V|undefined = (options as any)?.version
  ) {
    super(options as Partial<Deployment>)
    if (!this.version) throw new ClientError.NoVersion(this.constructor.name)
  }
}

/// ACT IV. ABSTRACT BUILDER, ABSTRACT UPLOADER, ABSTRACT DEPLOY STORE ////////////////////////////

/** Builders can be specified as ids, class names, or objects. */
export type IntoBuilder = string|BuilderClass<Builder>|Partial<Builder>

/** A constructor for a Builder subclass. */
export interface BuilderClass<B extends Builder> extends Overridable<Builder, IntoBuilder> {
}

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder extends CommandContext {
  /** Populated by @fadroma/build */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}): Builder {
    if (typeof specifier === 'string') {
      const B = Builder.variants[specifier]
      if (!B) throw new ClientError.NoBuilderNamed(specifier)
      return new (B as BuilderClass<Builder>)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoBuilder()
      return new (specifier as BuilderClass<Builder>)(options)
    } else {
      const B = Builder.variants[specifier?.id as string]
      return new (B as BuilderClass<Builder>)({ ...specifier, ...options })
    }
  }
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/build` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build <S extends ContractSource> (source: S, ...args: any[]): Promise<S>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: ContractSource[], ...args: unknown[]): Promise<ContractSource[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export type IntoUploader = string|UploaderClass<Uploader>|Partial<Uploader>

/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> extends Overridable<Uploader, IntoUploader> {
}

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {
  /** Populated by @fadroma/deploy */
  static variants: Record<string, UploaderClass<Uploader>> = {}
  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoUploader = '', options: Partial<Uploader> = {}): Uploader {
    if (typeof specifier === 'string') {
      const U = Uploader.variants[specifier]
      if (!U) throw new ClientError.NoUploaderNamed(specifier)
      return new (U as UploaderClass<Uploader>)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoUploader()
      return new (specifier as UploaderClass<Uploader>)(options)
    } else {
      const U = Uploader.variants[specifier?.id as string]
      return new (U as UploaderClass<Uploader>)({ ...specifier, ...options })
    }
  }
  constructor (public agent?: Agent|null) {}
  /** Chain to which this uploader uploads contracts. */
  get chain () { return this.agent?.chain }
  /** Fetch the code hash corresponding to a code ID */
  async getHash (id: CodeId): Promise<CodeHash> {
    return await this.agent!.getHash(Number(id))
  }
  /** Unique identifier of this uploader implementation. */
  abstract id: string
  /** Upload a contract.
    * @returns the contract with populated codeId and codeHash */
  abstract upload <T extends ContractSource> (template: T): Promise<T & {
    codeId:   CodeId
    codeHash: CodeHash,
  }>
  /** Upload multiple contracts. */
  abstract uploadMany (templates: ContractSource[]): Promise<ContractTemplate[]>
}

/** A moment in time. */
export type Moment   = number

/** A period of time. */
export type Duration = number

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** Transitional support for several of these:
  *  - YAML1 is how the latest @fadroma/deploy stores data
  *  - YAML2 is how @aakamenov's custom Rust-based deployer stores data
  *  - JSON1 is the intended target format for the next major version;
  *    JSON can generally be parsed with fewer dependencies, and can be
  *    natively embedded in the API client library distribution,
  *    in order to enable a standard subset of receipt data
  *    (such as the up-to-date addresses and code hashes for your production deployment)
  *    to be delivered alongside your custom Client subclasses,
  *    making your API client immediately usable with no further steps necessary. */
export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  unknown,
  Partial<Deployment>|undefined,
]> {}

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeploymentFormat, DeployStoreClass<DeployStore>>>

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export abstract class DeployStore {
  /** Populated in deploy.ts with the constructor for each subclass. */
  static variants: DeployStores = {}
  /** Get the names of all stored deployments. */
  abstract list   ():              string[]
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Update a deployment's data. */
  abstract set    (name: string, state?: Record<string, Partial<Contract<any>>>): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): Deployment|null

  defaults: Partial<Deployment> = {}
}

/** Throw appropriate error if not buildable. */
export function assertBuilder ({ builder }: { builder?: Builder }): Builder {
  //if (!this.crate) throw new ClientError.NoCrate()
  if (!builder) throw new ClientError.NoBuilder()
  //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
  return builder
}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new ClientError.NoUploader()
  //if (typeof uploader === 'string') throw new ClientError.ProvideUploader(uploader)
  if (!uploader.agent) throw new ClientError.NoUploaderAgent()
  return uploader
}

export function upload <T extends ContractTemplate & {
  uploader?: Uploader,
  codeHash?: CodeHash
}> (
  template:  T,
  uploader?: Uploader,
  agent:     Agent|null|undefined = uploader?.agent
): Promise<T> {
  // If the object already contains chain ID and code ID, that means it's uploaded
  if (template.chainId && template.codeId) {
    // If it also has the code hash, we're good to go
    if (template.codeHash) return Promise.resolve(template)
    // If it has no code hash, fetch it from the chain by the code id and that's it
    return fetchCodeHash(template, agent).then(codeHash=>Object.assign(template, { codeHash }))
  }
  // If the chain ID or code hash is missing though, it means we need to upload
  // Name the task
  const name = `upload ${getSourceSpecifier(template)}`
  return template.task(name, async (): Promise<T> => {
    // Otherwise we're gonna need the uploader
    uploader ??= assertUploader(template)
    // And if we still can't determine the chain ID, bail
    const chainId = undefined
      ?? uploader.chain?.id
      ?? uploader.agent?.chain?.id
      ?? (template as any)?.agent?.chain?.id
    if (!chainId) throw new ClientError.NoChainId()
    // If we have chain ID and code ID, try to get code hash
    if (template.codeId) template.codeHash = await fetchCodeHash(template, agent)
    // Replace with built and return uploaded
    if (!template.artifact) await template.build()
    return uploader.upload(template)
  })
}
