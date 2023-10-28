/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Console, Error, HEAD
} from './agent-base'
import type {
  Into, Name, ICoin, IFee, Label, Class, Address, CodeId, CodeHash, TxHash, Message
} from './agent-base'
import type {
  Agent, Chain, ChainId, ChainMode,
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

/** Helper for assigning only allowed properties of value object:
  * - safe, can't set unsupported properties 
  * - no need to state property name thrice
  * - doesn't leave `undefined`s */
export function assign <T extends {}> (
  object: T, properties: Partial<T> & any = {}, allowed: (keyof T)[] = []
) {
  for (const property of allowed) {
    if (property in properties) object[property] = properties[property]
  }
}

/** Allowlist for the value objects below. */
assign.allowed = {
  SourceCode: [
    'repository', 'revision', 'dirty', 'workspace', 'crate', 'features',
  ] as Array<keyof SourceCode>,
  CompiledCode: [
    'codeHash',
    'buildInfo', 'codePath', 'codeData'
  ] as Array<keyof CompiledCode>,
  ContractUpload: [
    'codeHash', 'chainId', 'codeId',
    'uploadTx', 'uploadBy', 'uploadGas', 'uploadInfo',
  ] as Array<keyof ContractUpload>,
  ContractInstance: [
    'codeHash', 'chainId', 'codeId', 'label', 'address', 'initMsg',
    'initBy', 'initSend', 'initFee', 'initMemo', 'initTx', 'initGas'
  ] as Array<keyof ContractInstance>,
  Deployment: [
    'name'
  ] as Array<keyof Deployment>,
  DeploymentUnit: [
    'name', 'deployment', 'isTemplate',
  ] as Array<keyof DeploymentUnit>
}

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
    assign(this, properties, assign.allowed['SourceCode'])
  }

  get [Symbol.toStringTag] () {
    return this.specifier
  }

  toReceipt () {
    return {
      repository: this.repository,
      revision:   this.revision,
      dirty:      this.dirty,
      workspace:  this.workspace,
      crate:      this.crate,
      features:   this.features?.join(', '),
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

  isValid () {
    return false
  }
}

export class CompiledCode {
  buildInfo?: string
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:  CodeHash
  /** Location of the compiled code. */
  codePath?:  string|URL
  /** The compiled code. */
  codeData?:  Uint8Array

  constructor (properties: Partial<CompiledCode> = {}) {
    assign(this, properties, assign.allowed['CompiledCode'])
  }

  get [Symbol.toStringTag] () {
    let tags = [
      this.codePath && `${this.codePath}`,
      this.codeHash && `${this.codeHash}`,
      this.codeData && `(${this.codeData.length} bytes)`
    ]
    return tags.filter(Boolean).join(' ')
  }

  isValid (): this is CompiledCode & { codeHash: CodeHash } {
    return !!this.codeHash
  }

  toReceipt () {
    return {
      codeHash:  this.codeHash,
      codePath:  this.codePath,
      buildInfo: this.buildInfo,
    }
  }

  async fetch (): Promise<Uint8Array> {
    if (this.codeData) {
      return this.codeData
    }
    if (!this.codePath) {
      throw new Error('Missing codePath')
    }
    if (typeof this.codePath === 'string') {
      return this.fetchFromPath(this.codePath)
    } else if (this.codePath instanceof URL) {
      return this.fetchFromURL(this.codePath)
    } else {
      throw new Error('Invalid codePath')
    }
  }

  protected async fetchFromPath (path: string) {
    const { readFile } = await import('node:fs/promises')
    return await readFile(path)
  }

  protected async fetchFromURL (url: URL) {
    if (url.protocol === 'file:') {
      const { fileURLToPath } = await import('node:url')
      return await this.fetchFromPath(fileURLToPath(url))
    } else {
      return new Uint8Array(await (await fetch(url)).arrayBuffer())
    }
  }

}

export class ContractUpload {
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash
  /** address of agent that performed the upload. */
  uploadBy?:   Address|Agent
  /** address of agent that performed the upload. */
  uploadGas?:  string|number
  /** extra info */
  uploadInfo?: string

  constructor (properties: Partial<ContractUpload> = {}) {
    assign(this, properties, assign.allowed['ContractUpload'])
  }

  toReceipt () {
    return {
      codeHash: this.codeHash,
      chainId:  this.chainId,
      codeId:   this.codeId,
      uploadBy: this.uploadBy,
      uploadTx: this.uploadTx,
    }
  }

  isValid (): this is ContractUpload & { codeId: CodeId } {
    return !!this.codeId
  }

  instance (options: Partial<ContractInstance>): ContractInstance {
    throw new Error('not implemented')
    //const instance = new ContractInstance(options)
    //Object.setPrototypeOf(instance, this)
    //for (const property of [
      //...assign.allowed['SourceCode'],
      //...assign.allowed['CompiledCode'],
      //...assign.allowed['ContractUpload'],
    //]) {
      //Object.defineProperty(this, property, { enumerable: true })
    //}
    //if (!instance.name) throw new Error.Missing.Name()
    //if (this.deployment) {
      //this.deployment.contracts.set(instance.name, instance)
    //}
    //return instance
  }

  /** Get a collection of multiple contracts from this template.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances (contracts: Many<Partial<ContractInstance>>): Many<ContractInstance> {
    return map(contracts, contract=>this.instance(contract))
  }

}

export class ContractInstance {
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:  CodeHash
  /** Code ID representing the identity of the contract's code on a specific chain. */
  chainId?:   ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:    CodeId
  /** Full label of the instance. Unique for a given Chain. */
  label?:     Label
  /** Address of this contract instance. Unique per chain. */
  address?:   Address
  /** Contents of init message. */
  initMsg?:   Into<Message>
  /** Address of agent that performed the init tx. */
  initBy?:    Address|Agent
  /** Native tokens to send to the new contract. */
  initSend?:  ICoin[]
  /** Fee to use for init. */
  initFee?:   unknown
  /** Instantiation memo. */
  initMemo?:  string
  /** TXID of transaction that performed the init. */
  initTx?:    TxHash
  /** Contents of init message. */
  initGas?:   unknown

  constructor (properties: Partial<ContractInstance> = {}) {
    assign(this, properties, assign.allowed['ContractInstance'])
  }

  /** @returns the data for a deploy receipt */
  toReceipt () {
    return {
      codeHash: this.codeHash,
      chainId:  this.chainId,
      codeId:   this.codeId,
      label:    this.label,
      address:  this.address,
      initMsg:  this.initMsg,
      initBy:   this.initBy,
      initTx:   this.initTx,
      initGas:  this.initGas,
    }
  }

  connect <C extends ContractClient> (agent: Agent, $C?: ContractClientClass<C>) {
    $C ??= ContractClient as ContractClientClass<C>
    return new $C(this, agent)
  }

  isValid (): this is ContractInstance & { address: Address } {
    return !!this.address
  }
}

export class Contract {
  source?:   SourceCode
  builder?:  Builder
  binary?:   CompiledCode
  uploader?: Agent|Address
  uploaded?: ContractUpload
  deployer?: Agent|Address
  instance?: ContractInstance
  constructor (properties?: PartialContract) {
    if (properties?.source)   this.source = new SourceCode(properties.source)
    if (properties?.builder)  this.builder = properties?.builder
    if (properties?.binary)   this.binary = new CompiledCode(properties.binary)
    if (properties?.uploader) this.uploader = properties?.uploader
    if (properties?.uploaded) this.uploaded = new ContractUpload(properties.uploaded)
    if (properties?.deployer) this.deployer = properties?.deployer
    if (properties?.instance) this.instance = new ContractInstance(properties.instance)
  }
  async compile ({
    builder = this.builder,
    rebuild = false,
    ...buildOptions
  }: {
    builder?: Builder
    rebuild?: boolean
  } = {}): Promise<CompiledCode & Parameters<Builder["build"]>[1] & {
    codeHash: CodeHash
  }> {
    if (this.binary?.isValid() && !rebuild) {
      return this.binary
    }
    if (!builder) {
      throw new Error("can't compile: no builder")
    }
    if (!this.source?.isValid()) {
      throw new Error("can't compile: no source")
    }
    this.binary = await builder.build(this.source, buildOptions)
    if (!this.binary?.isValid()) {
      throw new Error("build failed")
    }
    return this.binary
  }
  async upload ({
    builder  = this.builder,
    rebuild  = false,
    uploader = this.uploader,
    reupload = rebuild,
    ...uploadOptions
  }: Parameters<this["compile"]>[0] & Parameters<Agent["upload"]>[1] & {
    uploader?: Agent|Address
    reupload?: boolean,
  } = {}): Promise<ContractUpload & {
    codeId: CodeId
  }> {
    if (this.uploaded?.isValid() && !reupload && !rebuild) {
      return this.uploaded
    }
    if (!uploader || (typeof uploader === 'string')) {
      throw new Error("can't upload: no uploader agent")
    }
    const binary = await this.compile({ builder, rebuild })
    this.uploaded = await uploader.upload(binary, uploadOptions)
    if (!this.uploaded?.isValid()) {
      throw new Error("upload failed")
    }
    return this.uploaded
  }
  async deploy ({
    builder  = this.builder,
    rebuild  = false,
    uploader = this.uploader,
    reupload = rebuild,
    deployer = this.deployer,
    redeploy = reupload,
    ...initOptions
  }: Parameters<this["upload"]>[0] & Parameters<Agent["instantiate"]>[1] & {
    deployer?: Agent|Address
    redeploy?: boolean
  } = {}): Promise<ContractInstance & {
    address: Address
  }> {
    if (this.instance?.isValid() && !redeploy && !reupload && !rebuild) {
      return this.instance
    }
    if (!deployer || (typeof deployer === 'string')) {
      throw new Error("can't deploy: no deployer agent")
    }
    const uploaded = await this.upload({ builder, rebuild, uploader, reupload })
    this.instance = await deployer.instantiate(uploaded, initOptions)
    if (!this.instance.isValid()) {
      throw new Error("init failed")
    }
    return this.instance
  }
}

export type PartialContract = {
  source?:   Partial<SourceCode>,
  builder?:  Builder,
  binary?:   Partial<CompiledCode>,
  uploader?: Agent|Address,
  uploaded?: Partial<ContractUpload>,
  deployer?: Agent|Address,
  instance?: Partial<ContractInstance>
}

/** A contract that is part of a deploment.
  * - needed for deployment-wide deduplication
  * - generates structured label */
export class DeploymentUnit extends Contract {
  name?:       string
  deployment?: Deployment
  isTemplate?: boolean
  constructor (properties: Partial<DeploymentUnit> & PartialContract = {}) {
    super(properties)
    assign(this, properties, assign.allowed['DeploymentUnit'])
  }
}

export type DeploymentState = Partial<ReturnType<Deployment["toReceipt"]>>

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{ fromReceipt (receipt: DeploymentState): D }

/** A collection of contracts. */
export class Deployment extends Map<Name, DeploymentUnit> {
  name: string = timestamp()

  static fromReceipt ({ name, units = {} }: DeploymentState) {
    const deployment = new this({ name })
    for (const [key, value] of Object.entries(units)) {
      deployment.set(key, value)
    }
    return deployment
  }

  constructor (properties: Partial<Deployment> = {}) {
    super()
    assign(this, properties, assign.allowed['Deployment'])
    this.name ??= timestamp()
  }

  toReceipt () {
    return {
      name: this.name,
      units: Object.fromEntries(this.entries())
    }
  }

  set (name: string, unit: Partial<DeploymentUnit>): this {
    if (!(unit instanceof DeploymentUnit)) unit = new DeploymentUnit(unit)
    return super.set(name, unit as DeploymentUnit)
  }

  /** Define a template, representing code that can be compiled
    * and uploaded, but will not be automatically instantiated.
    * This can then be used to define multiple instances of
    * the same code. */
  template (name: string, properties?:
    Partial<SourceCode> &
    Partial<CompiledCode> &
    Partial<ContractUpload>
  ): DeploymentUnit {
    const template = new DeploymentUnit({
      name,
      deployment: this,
      isTemplate: true,
      source:   new SourceCode(properties),
      binary:   new CompiledCode(properties),
      uploaded: new ContractUpload(properties)
    })
    this.set(name, template)
    return template
  }

  /** Define a contract that will be automatically compiled, uploaded,
    * and instantiated as part of this deployment. */ 
  contract (name: string, properties?:
    Partial<SourceCode> &
    Partial<CompiledCode> &
    Partial<ContractUpload> &
    Partial<ContractInstance>
  ): DeploymentUnit {
    const contract = new DeploymentUnit({
      name,
      deployment: this,
      isTemplate: true,
      source:   new SourceCode(properties),
      binary:   new CompiledCode(properties),
      uploaded: new ContractUpload(properties)
    })
    this.set(name, contract)
    return contract
  }

  async build (
    options: Parameters<Contract["compile"]>[0]
  ): Promise<Record<CodeHash, CompiledCode & { codeHash: CodeHash }>> {
    const building: Array<Promise<CompiledCode & { codeHash: CodeHash }>> = []
    for (const [name, contract] of this.entries()) {
      building.push(contract.compile(options))
    }
    const built: Record<CodeHash, CompiledCode & { codeHash: CodeHash }> = {}
    for (const output of await Promise.all(building)) {
      built[output.codeHash] = output
    }
    return built
  }

  async upload (
    options: Parameters<Contract["upload"]>[0]
  ): Promise<Record<CodeId, ContractUpload & { codeId: CodeId }>> {
    const uploading: Array<Promise<ContractUpload & { codeId: CodeId }>> = []
    for (const [name, contract] of this.entries()) {
      uploading.push(contract.upload(options))
    }
    const uploaded: Record<CodeId, ContractUpload & { codeId: CodeId }> = {}
    for (const output of await Promise.all(uploading)) {
      uploaded[output.codeId] = output
    }
    return uploaded
  }

  async deploy (
    options: Parameters<Contract["deploy"]>[0]
  ): Promise<Record<Address, ContractInstance & { address: Address }>> {
    const deploying: Array<Promise<ContractInstance & { address: Address }>> = []
    for (const [name, contract] of this.entries()) {
      if (!contract.isTemplate) {
        deploying.push(contract.deploy({
          ...contract.instance,
          ...options,
        }))
      }
    }
    const deployed: Record<Address, ContractInstance & { address: Address }> = {}
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
  execute (message: Message, options: Parameters<Agent["execute"]>[2] = {}): Promise<void|unknown> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.execute(
      this.contract as ContractInstance & { address: Address },
      message,
      options
    )
  }

}
