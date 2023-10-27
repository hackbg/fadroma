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
import type {
  Builder, UploadStore, DeployStore
} from './agent-store'

import { hideProperties } from '@hackbg/hide'
import { validated, defineDefault, override } from '@hackbg/over'
import { into } from '@hackbg/into'
import { timestamp } from '@hackbg/logs'
import type { Many } from '@hackbg/many'
import { map } from '@hackbg/many'

const console = new Console()

export class SourceCode {
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
    this.repository = properties.repository ?? this.repository
    this.revision   = properties.revision   ?? this.revision
    this.dirty      = properties.dirty      ?? this.dirty
    this.workspace  = properties.workspace  ?? this.workspace
    this.crate      = properties.crate      ?? this.crate
    this.features   = properties.features   ?? this.features
  }

  get [Symbol.toStringTag] () {
    return this.specifier
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
    this.buildInfo = properties.buildInfo ?? this.buildInfo
    this.codeHash  = properties.codeHash  ?? this.codeHash
    this.codePath  = properties.codePath  ?? this.codePath
    this.codeData  = properties.codeData  ?? this.codeData
  }

  get [Symbol.toStringTag] () {
    return `${this.codeHash}`
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
    this.deployment = properties.deployment ?? this.deployment
    this.chainId    = properties.chainId    ?? this.chainId
    this.codeId     = properties.codeId     ?? this.codeId
    this.uploadTx   = properties.uploadTx   ?? this.uploadTx
    this.uploadBy   = properties.uploadBy   ?? this.uploadBy
    this.uploadGas  = properties.uploadGas  ?? this.uploadGas
    this.uploadInfo = properties.uploadInfo ?? this.uploadInfo
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
  ): Promise<ContractInstance & { address: Address }> {
    await this.upload(agent, {})
    return agent.instantiate(this, options)
  }

  instance (options: Partial<ContractInstance>): ContractInstance {
    return new ContractInstance({ ...options, ...this })
  }

  /** Get a collection of multiple contracts from this template.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances (contracts: Many<Partial<ContractInstance>>): Many<ContractInstance> {
    return map(contracts, contract=>this.instance(contract))
  }
}

export class ContractInstance extends ContractTemplate {
  /** Part of label. */
  name?:      Name
  /** Part of label. */
  prefix?:    Name
  /** Part of label. */
  suffix?:    Name
  /** Full label of the instance. Unique for a given Chain. */
  label?:     Label
  /** Address of this contract instance. Unique per chain. */
  address?:   Address
  /** Contents of init message. */
  initMsg?:   Into<Message>
  /** Address of agent that performed the init tx. */
  initBy?:    Address
  /** Native tokens to send to the new contract. */
  initFunds?: ICoin[]
  /** Fee to use for init. */
  initFee?:   unknown
  /** Instantiation memo. */
  initMemo?:  string
  /** TXID of transaction that performed the init. */
  initTx?:    TxHash
  /** Contents of init message. */
  initGas?:   unknown

  constructor (properties: Partial<ContractInstance> = {}) {
    super(properties as Partial<ContractTemplate>)
    this.name      = properties.name      ?? this.name
    this.prefix    = properties.prefix    ?? this.prefix
    this.suffix    = properties.suffix    ?? this.suffix
    this.label     = properties.label     ?? this.label
    this.address   = properties.address   ?? this.address
    this.initMsg   = properties.initMsg   ?? this.initMsg
    this.initBy    = properties.initBy    ?? this.initBy
    this.initFunds = properties.initFunds ?? this.initFunds
    this.initFee   = properties.initFee   ?? this.initFee
    this.initMemo  = properties.initMemo  ?? this.initMemo
    this.initTx    = properties.initTx    ?? this.initTx
    this.initGas   = properties.initGas   ?? this.initGas
  }

  /** @returns the data for a deploy receipt */
  toInstanceReceipt () {
    return {
      ...this.toUploadReceipt(),
      initMsg: this.initMsg,
      initBy:  this.initBy,
      initTx:  this.initTx,
      initGas: this.initGas,
      address: this.address,
      label:   this.label,
    }
  }

  async instantiate (agent: Agent, options: any): Promise<ContractInstance & {
    address: Address
  }> {
    if (this.address) {
      return this as this & { address: Address }
    } else {
      return super.instantiate(agent, options)
    }
  }

  connect <C extends ContractClient> (agent: Agent, $C?: ContractClientClass<C>) {
    $C ??= ContractClient as ContractClientClass<C>
    return new $C(this, agent)
  }

}

export type DeploymentState = Partial<ReturnType<InstanceType<typeof Deployment>["toReceipt"]>>

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{ fromReceipt (receipt: DeploymentState): D }

/** A collection of contracts. */
export class Deployment {

  name: string = timestamp()

  mode?: ChainMode

  store?: DeployStore

  templates: Map<string, ContractTemplate> = new Map()

  contracts: Map<string, ContractInstance> = new Map()

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
    this.name = properties.name ?? this.name ?? timestamp()
    this.mode = properties.mode ?? this.mode
    this.store = properties.store ?? this.store
    this.templates = properties.templates ?? this.templates
    this.contracts = properties.contracts ?? this.contracts
  }

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

  async build (options: {
    builder?: Builder
  } = {}): Promise<Record<CodeHash, CompiledCode>> {
    if (!options.builder) {
      throw new Error.Missing.Builder()
    }
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

  async upload (options: {
    agent?: Agent,
    builder?: Builder,
    uploadStore?: UploadStore,
  } = {}): Promise<Record<CodeId, ContractTemplate>> {
    if (!options.agent) {
      throw new Error.Missing.Agent()
    }
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

  async deploy (options: {
    agent?: Agent,
    builder?: Builder,
    uploadStore?: UploadStore,
    deployStore?: DeployStore,
  } = {}): Promise<Record<Address, ContractInstance>> {
    if (!options.agent) {
      throw new Error.Missing.Agent()
    }
    console.log({deployment:this})
    console.log({contracts:this.contracts})
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

/** A constructor for a ContractClient subclass. */
export interface ContractClientClass<C extends ContractClient> extends
  Class<C, [Address|Partial<ContractInstance>, Agent|undefined]> {}

/** ContractClient: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class ContractClient {
  log = new Console(this.constructor.name)

  contract: ContractInstance

  agent?: Agent

  constructor (contract: Address|Partial<ContractInstance>, agent?: Agent) {
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
