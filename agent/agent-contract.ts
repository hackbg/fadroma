/**
  Fadroma: Contract Deployment API
  Copyright (C) 2023 Hack.bg

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

import {
  Console, Error, HEAD
} from './agent-base'
import type {
  Into, Name, ICoin, IFee, Label, Class, Address, CodeId, CodeHash, TxHash, Message
} from './agent-base'
import type {
  Agent, Chain, ChainId, ChainMode, ExecOpts
} from './agent-chain'

import { hideProperties } from '@hackbg/hide'
import { validated, defineDefault, override } from '@hackbg/over'
import { into } from '@hackbg/into'
import { timestamp } from '@hackbg/logs'

const console = new Console()

export class ValueObject {
  protected override (key: keyof typeof this, value: typeof this[keyof typeof this]) {
    this[key] = value ?? this[key]
  }
  protected overrideAll <T extends ValueObject> (this: T, options: Partial<T>, names: (keyof T)[]) {
    for (const key in options) {
      if (names.includes(key)) {
        this[key] = options[key] ?? this[key]
      } else {
        console.warn(`ignoring property: ${key}`)
      }
    }
  }
}

export class SourceCode extends ValueObject {
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL
  /** Branch/tag pointing to the source commit. */
  revision?: string
  /** Whether there were any uncommitted changes at build time. */
  dirty?: boolean
  /** Path to root directory of crate or workspace. */
  workspace?: string
  /** Name of crate in workspace. */
  crate?: string
  /** List of crate features to enable during build. */
  features?: string[]

  constructor (properties: Partial<SourceCode> = {}) {
    super()
    this.overrideAll(properties, [
      'repository', 'revision', 'dirty', 'workspace', 'crate', 'features'
    ])
  }

  toSourceReceipt () {
    return {
      repository: this.repository,
      revision:   this.revision,
      dirty:      this.dirty,
      workspace:  this.workspace,
      crate:      this.crate,
      features:   this.features?.join(', '),
    }
  }

  async compile (builder: Builder): Promise<CompiledCode & { codeHash: CodeHash }> {
    return new CompiledCode({ ...this, ...await builder.build({...this}) }) as CompiledCode & {
      codeHash: CodeHash
    }
  }

  /** @returns a string in the format `repo@ref|crate[+flag][+flag]...` */
  get specifier (): string {
    const { repository, revision, crate, features, dirty } = this
    let result = `${repository}@${revision}|${crate}`
    if (features && features.length > 0) result = `${result}+${features.join('+')}`
    if (dirty) result = `(*)${result}`
    return result
  }
}

export abstract class Builder {

  static variants: Record<string, Class<Builder, any>> = {}

  log = new Console(this.constructor.name)

  /** Whether to enable build caching.
    * When set to false, this builder will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this builder implementation. */
  abstract id: string

  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (
    buildable: string|Partial<CompiledCode>,
    ...args: any[]
  ): Promise<CompiledCode>

  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  abstract buildMany (
    sources: (string|Partial<CompiledCode>)[],
    ...args: unknown[]
  ): Promise<CompiledCode[]>
}

export class StubBuilder {
  id = 'stub'
  log = new Console(this.constructor.name)
  caching = false
  async build (
    source: string|Partial<CompiledCode>,
    ...args: any[]
  ): Promise<CompiledCode> {
    if (typeof source === 'string') {
      source = new CompiledCode({ repository: source })
    } else {
      source = new CompiledCode(source)
    }
    return source as CompiledCode
  }
  async buildMany (
    sources: (string|Partial<CompiledCode>)[],
    ...args: unknown[]
  ): Promise<CompiledCode[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export class CompiledCode extends SourceCode {
  buildInfo?: string
  /** Code hash uniquely identifying the compiled code. */
  codeHash?: CodeHash
  /** Location of the compiled code. */
  codePath?: string|URL
  /** The compiled code. */
  codeData?: Uint8Array

  constructor (properties: Partial<CompiledCode> = {}) {
    super(properties)
    this.overrideAll(properties, [
      'buildInfo', 'codeHash', 'codePath', 'codeData'
    ])
  }

  toBuildReceipt () {
    return {
      ...super.toSourceReceipt(),
      buildInfo: this.buildInfo,
      codePath:  this.codePath,
      codeHash:  this.codeHash
    }
  }

  async fetchCode (): Promise<Uint8Array> {
    if (this.codeData) {
      return this.codeData
    }
    if (!this.codePath) {
      throw new Error('Missing codePath')
    }
    if (typeof this.codePath === 'string') {
      return this.fetchCodeFromPath(this.codePath)
    } else if (this.codePath instanceof URL) {
      return this.fetchCodeFromURL(this.codePath)
    } else {
      throw new Error('Invalid codePath')
    }
  }

  private async fetchCodeFromPath (path: string) {
    const { readFile } = await import('node:fs/promises')
    return await readFile(path)
  }

  private async fetchCodeFromURL (url: URL) {
    if (url.protocol === 'file:') {
      const { fileURLToPath } = await import('node:url')
      return await this.fetchCodeFromPath(fileURLToPath(url))
    } else {
      return new Uint8Array(await (await fetch(url)).arrayBuffer())
    }
  }

  async compile (builder: Builder): Promise<CompiledCode & { codeHash: CodeHash }> {
    if (this.codeHash) {
      return this as CompiledCode & { codeHash: CodeHash }
    } else {
      return super.compile(builder)
    }
  }

  async recompile (builder: Builder): Promise<CompiledCode> {
    return super.compile(builder)
  }

  async upload (
    agent: Agent, options: Parameters<typeof agent["upload"]>[1]
  ): Promise<ContractTemplate & {
    chainId: ChainId,
    codeId:  CodeId
  }> {
    return new ContractTemplate({
      ...this, ...await agent.upload(this, options)
    }) as ContractTemplate & {
      chainId: ChainId,
      codeId:  CodeId
    }
  }
}

export class ContractTemplate extends CompiledCode {
  /** Whether this object belongs to a deployment. */
  deployment?: Deployment
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash
  /** address of agent that performed the upload. */
  uploadBy?:   Address
  /** address of agent that performed the upload. */
  uploadGas?:  string|number
  /** extra info */
  uploadInfo?: string

  constructor (properties: Partial<ContractTemplate> = {}) {
    super(properties)
    this.overrideAll(properties, [
      'deployment', 'uploadInfo', 'chainId', 'uploadBy', 'uploadTx', 'codeId'
    ])
  }

  toUploadReceipt () {
    return {
      ...super.toBuildReceipt(),
      chainId:  this.chainId,
      uploadBy: this.uploadBy,
      uploadTx: this.uploadTx,
      codeId:   this.codeId
    }
  }

  async upload (
    agent: Agent, options: Parameters<typeof agent["upload"]>[1]
  ): Promise<ContractTemplate & {
    chainId: ChainId,
    codeId:  CodeId
  }> {
    if (this.codeId && this.chainId) {
      return this as ContractTemplate & {
        chainId: ChainId,
        codeId: CodeId
      }
    } else {
      return super.upload(agent, options)
    }
  }

  async reupload (
    agent: Agent, options: Parameters<typeof agent["upload"]>[1]
  ): Promise<ContractTemplate> {
    return super.upload(agent, options)
  }

  async instantiate (
    agent: Agent, options: Parameters<typeof agent["instantiate"]>[1]
  ): Promise<ContractInstance> {
    return agent.instantiate(this, options)
  }

  instance (options: any): ContractInstance {
    return new ContractInstance({ ...options, ...this })
  }
}

export class ContractInstance extends ContractTemplate {
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label
  /** Address of this contract instance. Unique per chain. */
  address?: Address
  /** Address of agent that performed the init tx. */
  initBy?:  Address
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash
  /** Contents of init message. */
  initMsg?: Message

  constructor (properties: Partial<ContractInstance> = {}) {
    super(properties)
    this.overrideAll(properties, [
      'initBy', 'initMsg', 'initTx', 'address', 'label'
    ])
  }

  /** @returns the data for a deploy receipt */
  toInstanceReceipt () {
    return {
      ...this.toUploadReceipt(),
      initBy:  this.initBy,
      initMsg: this.initMsg,
      initTx:  this.initTx,
      address: this.address,
      label:   this.label,
    }
  }

  async instantiate (agent: Agent, options: any): Promise<ContractInstance> {
    return this
  }

  connect <C extends ContractClient> (agent: Agent, $C?: ContractClientClass<C>) {
    return new ($C||ContractClient)(agent, this)
  }

}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export abstract class DeployStore {

  /** Default values for Deployments created from this store. */
  defaults: Partial<Deployment> = {}

  /** Create a new Deployment, and populate with stored data.
    * @returns Deployer */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as unknown as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    const { name } = args[0] ??= {}
    const deployment: D = $D.fromReceipt((name && this.load(name)) || {})
    deployment.store = this
    return deployment
  }

  /** Get the names of all stored deployments. */
  abstract list (): string[]

  /** Get a deployment by name, or the active deployment if none is passed. 
    * @returns Deployment, or null if such doesn't exist. */
  abstract load (name: string|null|undefined): DeploymentState|null

  /** Update a deployment's data. */
  abstract save (name: string, state?: DeploymentState): void

  /** Create a new deployment. */
  abstract create (name?: string): Promise<DeploymentState>

  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string): Promise<DeploymentState>

  /** Get name of the active deployment, or null if there isn't one. */
  abstract get activeName (): string|null

}

export type DeploymentState = Partial<ReturnType<InstanceType<typeof Deployment>["toReceipt"]>>

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{ fromReceipt (receipt: DeploymentState): D }

/** A collection of contracts. */
export class Deployment extends ValueObject {

  name?: string

  mode?: ChainMode

  store?: DeployStore

  templates: Map<string, ContractTemplate> = new Map()

  contracts: Map<string, ContractInstance> = new Map()

  toReceipt () {
    const templates: Record<string, ContractTemplate> = {}
    const contracts: Record<string, ContractInstance> = {}
    for (const [name, template] of this.templates.entries()) {
      templates[name] = template
    }
    for (const [name, contract] of this.contracts.entries()) {
      contracts[name] = contract
    }
    return {
      name: this.name,
      mode: this.mode,
      templates,
      contracts
    }
  }

  static fromReceipt (receipt: DeploymentState) {
    const name = receipt.name
    const deployment = new this({ name })
    const templates = new Map()
    for (const [name, template] of Object.entries(receipt.templates || {})) {
      deployment.templates.set(name, deployment.template(template))
    }
    const contracts = new Map()
    for (const [name, contract] of Object.entries(receipt.contracts || {})) {
      deployment.contracts.set(name, deployment.contract(name, contract))
    }
    return deployment
  }

  constructor (properties: Partial<Deployment> = {}) {
    super()
    properties = { name: timestamp(), ...properties }
    this.overrideAll(properties, [ 'name', 'mode', 'store', 'templates', 'contracts' ])
  }

  template (options?: Partial<ContractTemplate>): ContractTemplate {
    const template = new ContractTemplate({ deployment: this, ...options })
    this.templates.set(template.specifier, template)
    return template
  }

  contract (name: string, options?: Partial<ContractInstance>): ContractInstance {
    const contract = new ContractInstance({ deployment: this, ...options })
    this.contracts.set(name, contract)
    return contract
  }

  async build (options: { builder: Builder }): Promise<Record<CodeHash, CompiledCode>> {
    const building: Array<Promise<CompiledCode & { codeHash: CodeHash }>> = []
    for (const [name, contract] of this.templates.entries()) {
      building.push(contract.compile(options.builder))
    }
    const built: Record<CodeHash, CompiledCode> = {}
    for (const output of await Promise.all(building)) {
      built[output.codeHash] = output
    }
    return built
  }

  async upload (options: { agent: Agent }): Promise<Record<CodeId, ContractTemplate>> {
    const uploading: Array<Promise<ContractTemplate & { codeId: CodeId }>> = []
    for (const [name, contract] of this.templates.entries()) {
      uploading.push(contract.upload(options.agent, {}))
    }
    const uploaded: Record<CodeId, ContractTemplate> = {}
    for (const output of await Promise.all(uploading)) {
      uploaded[output.codeId] = output
    }
    return uploaded
  }

  async deploy (options: { agent: Agent }): Promise<Record<Address, ContractInstance>> {
    const deploying: Array<Promise<ContractInstance & { address: Address }>> = []
    for (const [name, contract] of this.contracts.entries()) {
      deploying.push(contract.instantiate(options.agent, {}))
    }
    const deployed: Record<Address, ContractInstance> = {}
    for (const output of await Promise.all(deploying)) {
      deployed[output.address] = output
    }
    return deployed
  }

}

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export class DeploymentContractLabel {
  /** RegExp for parsing labels of the format `prefix/name+suffix` */
  static RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

  constructor (
    public prefix?: string,
    public name?:   string,
    public suffix?: string,
  ) {}

  /** Construct a label from prefix, name, and suffix. */
  toString () {
    let name = this.name
    if (this.prefix) name = `${this.prefix}/${name}`
    if (this.suffix) name = `${name}+${this.suffix}`
    return name
  }

  /** Parse a label into prefix, name, and suffix. */
  static parse (label: string): DeploymentContractLabel {
    const matches = label.match(DeploymentContractLabel.RE_LABEL)
    if (!matches || !matches.groups) throw new Error.Invalid.Label(label)
    const { name, prefix, suffix } = matches.groups
    if (!name) throw new Error.Invalid.Label(label)
    return new DeploymentContractLabel(prefix, name, suffix)
  }

  static async fetch (
    address: Address, agent: Agent, expected?: Label
  ): Promise<DeploymentContractLabel> {
    return DeploymentContractLabel.parse(await agent.getLabel(address))
  }
}

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  unknown,
  (Partial<Deployment>|undefined)?,
]> {}

export type DeploymentFormat = 'v1'

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeploymentFormat, DeployStoreClass<DeployStore>>>

/** A constructor for a ContractClient subclass. */
export interface ContractClientClass<C extends ContractClient> extends
  Class<C, [Agent, Address|Partial<ContractInstance>]> {}

/** ContractClient: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class ContractClient {
  log = new Console(this.constructor.name)

  contract: ContractInstance

  agent?: Agent

  constructor (
    contract: Address|Partial<ContractInstance>,
    agent?: Agent
  ) {
    this.agent = agent
    if (typeof contract === 'string') {
      this.contract = new ContractInstance({ address: contract })
    } else if (contract instanceof ContractInstance) {
      this.contract = contract
    } else {
      this.contract = new ContractInstance(contract)
    }
  }

  /** The chain on which this contract exists. */
  get chain (): Chain|undefined {
    return this.agent?.chain
  }

  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.query(this.contract as ContractInstance & { address: Address }, msg)
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.execute(this.contract as ContractInstance & { address: Address }, msg, opt)
  }

}
