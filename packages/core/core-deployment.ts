import { timestamp }      from '@hackbg/konzola'
import { CommandContext } from '@hackbg/komandi'
import type { Task }      from '@hackbg/komandi'

import { ClientError, ClientConsole } from './core-events'
import { hide, defineDefault } from './core-fields'
import { mapAsync } from './core-fields'
import { buildMany } from './core-build'
import { uploadMany } from './core-upload'
import { ClientError as Error, ClientConsole as Console } from './core-events'
import { assertAgent } from './core-agent'
import { defineContract } from './core-contract'
import { into, intoRecord, defineTask, call } from './core-fields'
import { writeLabel } from './core-labels'

import type {
  Contract, AnyContract, DeployContract, DeployAnyContract,
  Buildable, Uploadable, Instantiable, Instantiated
} from './core-contract'
import type { Agent } from './core-agent'
import type { Builder } from './core-build'
import type { Chain } from './core-chain'
import type { Class, Many, Name, Named, IntoRecord } from './core-fields'
import type { Client } from './core-client'
import type { Uploader } from './core-upload'

/** The collection of contracts that constitute a deployment. */
export type DeploymentState = Record<string, Partial<AnyContract>>

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{}

export async function defineDeployment <D extends Deployment> (
  options: Partial<D> = {},
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>
): Promise<D> {
  return new $D(options)
}

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment extends CommandContext {
  log = new ClientConsole('Fadroma.Deployment')

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string          = timestamp()
  /** Mapping of names to contract instances. */
  state:       DeploymentState = {}
  /** Default Git ref from which contracts will be built if needed. */
  repository?: string          = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?:  string          = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?:   string          = 'HEAD'
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?:    Builder
  /** Agent to use when deploying contracts. */
  agent?:      Agent
  /** Chain on which operations are executed. */
  chain?:      Chain
  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:   Uploader

  constructor (context: Partial<Deployment> = {}) {
    super(context.name ?? 'Deployment')
    this.log.name  = this.name ?? this.log.name
    // These propertied are inherited by default
    for (const field of [
      'name', 'state', 'agent', 'chain', 'builder', 'uploader', 'workspace', 'revision'
    ]) {
      defineDefault(this, context, field as keyof Partial<Deployment>)
    }
    // Hidden properties
    hide(this, [
      'log', 'state', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ])
    this.addCommand('status', 'show the status of this deployment', this.showStatus.bind(this))
  }

  get [Symbol.toStringTag]() {
    return `${this.name??'-'}`
  }

  /** Number of contracts in deployment. */
  get size (): number {
    return Object.keys(this.state).length
  }

  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean {
    return this.chain?.devMode   ?? false
  }

  /** = chain.isMainnet */
  get isMainnet (): boolean {
    return this.chain?.isMainnet ?? false
  }

  /** = chain.isTestnet */
  get isTestnet (): boolean {
    return this.chain?.isTestnet ?? false
  }

  /** = chain.isDevnet */
  get isDevnet  (): boolean {
    return this.chain?.isDevnet  ?? false
  }

  /** = chain.isMocknet */
  get isMocknet (): boolean {
    return this.chain?.isMocknet ?? false
  }

  /** Print the status of this deployment. */
  async showStatus () {
    this.log.deployment(this)
  }

  /** Specify a contract.
    * @returns a callable `Contract` with the specified parameters. */
  contract       = defineDeployContractAPI(this)

  /** Specify a group of heterogeneous contracts.
    * @returns a callable key-value map of `Contract`s with the specified parameters. */
  contractGroup  = defineDeployGroupAPI(this)

  /** Implemented by Deployer subclass in @fadroma/deploy
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

}

export class VersionedDeployment<V> extends Deployment {
  constructor (
    options: object = {},
    public version: V|undefined = (options as any)?.version
  ) {
    super(options as Partial<Deployment>)
    if (!this.version) throw new ClientError.NoVersion(this.constructor.name)
  }
}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts),
  * and whose constructor takes a Deployer as first argument, as well as any number of
  * other arguments. This interface can be used to connect the main project class to individual
  * deployer classes for different parts of the project, enabling them to operate in the same
  * context (chain, agent, builder, uploader, etc). */
export interface Subsystem<D extends Deployment, E extends Deployment> extends Class<D, [
  E, ...unknown[]
]> {}

type DeploymentContractAPI = DefineContract & DeploymentContractMethods

type DefineContract = <C extends Client>(arg?: string|Partial<Contract<C>>) => Contract<C>

/** Methods for managing individual contracts in a `Deployment` */
interface DeploymentContractMethods {
  /** Check if the deployment contains a contract with a certain name. */
  has (name: string): boolean
  /** Get the Contract corresponding to a given name. */
  get <C extends Client> (name: string): Task<DeployContract<C>, C>|null
  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. */
  set <C extends Client> (name: string, task: DeployContract<C>): Contract<C>
  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. Chainable. */
  add <C extends Client> (name: string, data: DeployContract<C>): this
  /** Throw if a contract with the specified name is not found in this deployment. */
  expect <C extends Client> (id: string, message?: string): DeployContract<C>
}

export function defineDeployContractAPI <D extends Deployment> (
  self: D
): DeploymentContractAPI {

  return Object.assign(defineContractInDeployment.bind(self), {

    has (id) {
      return !!self.state[id]
    },

    get (id) {
      return self.state[id]
    },

    set <C extends Client> (id: string, contract: Contract<C>) {
      contract.context = self
      attachToDeployment(contract, self)
      self.state[id] = contract
      self.save()
      return contract
    },

    add (id: Name, contract) {
      this.set(id, contract)
      return self
    },

    expect (id, message) {
      message ??= `${id}: no such contract in deployment`
      if (!this.has(id)) throw new Error(message)
      return this.get(id)
    },

  } as DeploymentContractMethods)

  function defineContractInDeployment <C extends Client> (
    this: D, arg: string|Partial<Contract<C>> = {}
  ): DeployContract<C> {
    const id = (typeof arg === 'string') ? arg : arg.id
    const opts = (typeof arg === 'string') ? { id } : arg
    opts.agent ??= this.agent
    if (id && this.contract.has(id)) {
      return this.contract.get<C>(id)!.context!
    } else {
      const contract = defineContract({
        workspace: this.config?.build?.project,
        ...opts,
        prefix:  this.name,
        context: this
      })
      this.contract.set(contract.name!, contract)
      return contract
    }
  }

}

type MatchPredicate =
  (meta: Partial<AnyContract>) => boolean|undefined

type DeploymentContractsAPI<D extends Deployment> =
  DefineContracts<D> & DeploymentContractsMethods

type DefineContracts<D extends Deployment> =
  (contracts: Many<AnyContract>) => Task<D, Many<Client>>

/** Methods for managing groups of contracts in a `Deployment` */
interface DeploymentContractsMethods {
  /** Add multiple contracts to this deployment. */
  set (contracts: Array<Client|AnyContract>): this
  set (contracts: Record<string, Client|AnyContract>): this
  /** Compile multiple contracts. */
  build (contracts: (string|AnyContract)[]): Promise<AnyContract[]>
  /** Upload multiple contracts. */
  upload (contracts: AnyContract[]): Promise<AnyContract[]>
}

export function defineDeployContractsAPI <D extends Deployment> (
  self: D
): DeploymentContractsAPI<D> {

  return Object.assign(defineContractsInDeployment, {

    set (this: Deployment, contracts: AnyContract[]|Named<AnyContract>) {
      throw new Error('TODO')
      for (const [name, receipt] of Object.entries(contracts)) {
        self.state[name] = receipt
      }
      self.save()
      return self
    },

    build (contracts: (string|AnyContract)[]) {
      return buildMany(contracts as unknown as Buildable[], self)
    },

    upload (contracts: AnyContract[]) {
      return uploadMany(contracts as unknown as Uploadable[], self)
    }

  })

  function defineContractsInDeployment (contracts: Many<AnyContract>): Task<D, Many<Client>> {
    const length = Object.entries(contracts).length
    const name = (length === 1) ? `deploy contract` : `deploy ${length} contracts`
    return defineTask(name, deployMultipleContracts, self)
    async function deployMultipleContracts (): Promise<Many<Client>> {
      return await mapAsync(contracts, call)
    }
  }

}

/** Returns a function that defines a contract group. */
export function defineDeployGroupAPI <D extends Deployment> (self: D) {
  /** Callable object for consistency, but no submethods yet. */
  return Object.assign(defineContractGroupTemplate.bind(self), {})
  /** Returns a function deploying the contract group one or more times. */
  function defineContractGroupTemplate <A extends unknown[]> (
    /** Function that returns the contracts belonging to an instance of the group. */
    getContracts: (...args: A)=>Many<AnyContract>
  ): (...args: A) => ContractGroup<A> {
    return Object.assign(defineContractGroup, {
      /** Define multiple instances of the contract group. */
      many (instances: Many<A>) {
        /** Define a contract group corresponding to each member of `instances` */
        const groups = mapAsync(
          instances,
          defineContractGroup as unknown as (x:A[0])=>ContractGroup<A>
        )
        /** Deploy the specified contract groups. */
        return async function deployContractGroups (...args: A) {
          return await mapAsync(
            /** Reify the specified contract groups */
            await groups,
            /** Deploy each contract group. */
            function deployContractGroup (group: ContractGroup<A>) {
              return group.deploy(...args)
            }
          )
        }
      }
    })
    /** Defines a new contract group. */
    function defineContractGroup (...args: A) {
      return new ContractGroup(self, getContracts(...args))
    }
  }
}

export class ContractGroup<A extends unknown[]> {

  constructor (
    public readonly context:   Deployment,
    public readonly contracts: Many<AnyContract>
  ) {}

  async deploy (...args: A) {
    await buildMany(Object.values(this.contracts) as unknown as Buildable[], this.context)
    await uploadMany(Object.values(this.contracts) as unknown as Uploadable[], this.context)
    return await mapAsync(this.contracts, (contract: AnyContract)=>contract.deployed)
  }

}

/** This function attaches a contract representation object to a deployment.
  * This sets the contract prefix to the deployment name, and provides defaults. */
export function attachToDeployment <T extends { context?: Deployment, log?: { warn: Function } }> (
  self: T, context: Deployment
): T {

  self.context = context
  //defineDefault(self, context, 'log')
  defineDefault(self, context, 'agent')
  defineDefault(self, context, 'builder')
  defineDefault(self, context, 'uploader')
  defineDefault(self, context, 'repository')
  defineDefault(self, context, 'revision')
  defineDefault(self, context, 'workspace')
  setPrefix(self, context.name)

  return self

  function setPrefix (self: T, value: string) {
    Object.defineProperty(self, 'prefix', {
      enumerable: true,
      get () { return self.context?.name },
      set (v: string) {
        if (v !== self.context?.name) {
          self.log!.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
        }
        setPrefix(self, v)
      }
    })
  }

}
