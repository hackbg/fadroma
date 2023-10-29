/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, Error, assign, timestamp, into, map } from './base'
import type { Into, Name, Label, Class, Address, TxHash, Message, Many } from './base'
import type { Agent, Chain, ChainId, ChainMode, } from './chain'
import type { UploadStore, DeployStore } from './store'
import type { Builder, CodeId, CodeHash } from './code'
import type { ICoin, IFee } from './token'
import { ContractCode, SourceCode, CompiledCode, UploadedCode } from './code'
import { ContractClient } from './client'
import type { ContractClientClass } from './client'

assign.allow('DeploymentUnit', [
  'name', 'deployment', 'isTemplate', 'codeHash', 'chainId', 'codeId', 
] as Array<keyof DeploymentUnit>)

assign.allow('ContractInstance', [
  'label', 'address', 'initMsg', 'initBy', 'initSend', 'initFee', 'initMemo', 'initTx', 'initGas'
] as Array<keyof ContractInstance>)

assign.allow('Deployment', [
  'name'
] as Array<keyof Omit<Deployment, keyof Map<any, any>>>)

const console = new Console()

/** A contract that is part of a deploment.
  * - needed for deployment-wide deduplication
  * - generates structured label */
export class DeploymentUnit extends ContractCode {
  /** Name of this unit. */
  name?:       string
  /** Deployment to which this unit belongs. */
  deployment?: Deployment
  /** If true, instantiation. */
  isTemplate?: boolean
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash
  /** Code ID representing the identity of the contract's code on a specific chain. */
  chainId?:    ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId

  constructor (
    properties: ConstructorParameters<typeof ContractCode>[0] & Partial<DeploymentUnit> = {}
  ) {
    super(properties)
    assign(this, properties, 'DeploymentUnit')
  }
}

export class ContractInstance extends DeploymentUnit {
  /** Full label of the instance. Unique for a given Chain. */
  label?:    Label
  /** Address of this contract instance. Unique per chain. */
  address?:  Address
  /** Contents of init message. */
  initMsg?:  Into<Message>
  /** Address of agent that performed the init tx. */
  initBy?:   Address|Agent
  /** Native tokens to send to the new contract. */
  initSend?: ICoin[]
  /** Fee to use for init. */
  initFee?:  unknown
  /** Instantiation memo. */
  initMemo?: string
  /** ID of transaction that performed the init. */
  initTx?:   TxHash
  /** Contents of init message. */
  initGas?:  unknown

  constructor (
    properties?: ConstructorParameters<typeof DeploymentUnit>[0] & Partial<ContractInstance>
  ) {
    super(properties)
    assign(this, properties, 'ContractInstance')
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
    if (this.isValid() && !redeploy && !reupload && !rebuild) {
      return this
    }
    if (!deployer || (typeof deployer === 'string')) {
      throw new Error("can't deploy: no deployer agent")
    }
    const uploaded = await this.upload({ builder, rebuild, uploader, reupload })
    const instance = await deployer.instantiate(uploaded, initOptions)
    if (!instance.isValid()) {
      throw new Error("init failed")
    }
    return this
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

export class ContractTemplate extends DeploymentUnit {

  /** Create a new instance of this contract. */
  contract (
    name: Name, parameters: Partial<ContractInstance> = {}
  ): ContractInstance {
    return new ContractInstance({ ...this, name, parameters })
  }

  /** Create multiple instances of this contract. */
  contracts (
    instanceParameters: Record<Name, Parameters<ContractTemplate["contract"]>[0]> = {}
  ): Record<keyof typeof instanceParameters, ContractInstance> {
    const instances: Record<keyof typeof instanceParameters, ContractInstance> = {}
    for (const [name, parameters] of Object.entries(instanceParameters)) {
      instances[name] = this.contract(parameters)
    }
    return instances
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
    assign(this, properties, 'Deployment')
    this.name ??= timestamp()
  }

  toReceipt () {
    return {
      name: this.name,
      units: Object.fromEntries(this.entries())
    }
  }

  set (name: string, unit: DeploymentUnit): this {
    if (!(unit instanceof DeploymentUnit)) {
      throw new Error('a Deployment can only contain instances of DeploymentUnit')
    }
    return super.set(name, unit)
  }

  /** Define a template, representing code that can be compiled
    * and uploaded, but will not be automatically instantiated.
    * This can then be used to define multiple instances of
    * the same code. */
  template (name: string, properties?:
    Partial<SourceCode> &
    Partial<CompiledCode> &
    Partial<UploadedCode>
  ): DeploymentUnit {
    const template = new DeploymentUnit({
      name,
      deployment: this,
      isTemplate: true,
      source:   new SourceCode(properties),
      compiled: new CompiledCode(properties),
      uploaded: new UploadedCode(properties)
    })
    this.set(name, template)
    return template
  }

  /** Define a contract that will be automatically compiled, uploaded,
    * and instantiated as part of this deployment. */ 
  contract (name: string, properties?:
    Partial<SourceCode> &
    Partial<CompiledCode> &
    Partial<UploadedCode> &
    Partial<ContractInstance>
  ): DeploymentUnit {
    const contract = new DeploymentUnit({
      name,
      deployment: this,
      isTemplate: true,
      source:   new SourceCode(properties),
      compiled: new CompiledCode(properties),
      uploaded: new UploadedCode(properties)
    })
    this.set(name, contract)
    return contract
  }

  async build (
    options: Parameters<ContractCode["compile"]>[0] = {}
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
    options: Parameters<ContractCode["upload"]>[0] = {}
  ): Promise<Record<CodeId, UploadedCode & { codeId: CodeId }>> {
    const uploading: Array<Promise<UploadedCode & { codeId: CodeId }>> = []
    for (const [name, contract] of this.entries()) {
      uploading.push(contract.upload(options))
    }
    const uploaded: Record<CodeId, UploadedCode & { codeId: CodeId }> = {}
    for (const output of await Promise.all(uploading)) {
      uploaded[output.codeId] = output
    }
    return uploaded
  }

  async deploy (
    options: Parameters<ContractInstance["deploy"]>[0] = {}
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
    if (!matches || !matches.groups) {
      throw new Error(`label does not match format: ${label}`)
    }
    const { name, prefix, suffix } = matches.groups
    if (!name) {
      throw new Error(`label does not match format: ${label}`)
    }
    return new DeploymentContractLabel(prefix, name, suffix)
  }

  static async fetch (
    address: Address, agent: Agent, expected?: Label
  ): Promise<DeploymentContractLabel> {
    return DeploymentContractLabel.parse(await agent.getLabel(address))
  }
}
