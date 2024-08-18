/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  CompiledCode,
  Console,
  Contract,
  Logged,
  RustSourceCode,
  SourceCode,
  UploadStore,
  UploadedCode,
  assign,
  bold,
  hideProperties,
  timestamp,
} from '@hackbg/fadroma'
import type {
  Address,
  Agent,
  ChainId,
  CodeHash,
  CodeId,
  Compiler,
  Into,
  Label,
  Message,
  Name,
  Token,
  TxHash,
} from '@hackbg/fadroma'
import * as Impl from './deploy-impl'
import type { Deployment } from './Deployment'

/** Represents a contract's code in all its forms, and the contract's lifecycle
  * up to and including uploading it, but not instantiating it. */
export class ContractLifecycle extends Logged {
  source?:   SourceCode
  compiler?: Compiler
  compiled?: CompiledCode
  uploader?: Agent|Address
  uploaded?: UploadedCode
  deployer?: Agent|Address

  constructor (properties?: Partial<ContractLifecycle>) {
    super(properties)
    assign(this, properties, [
      'source',
      'compiler',
      'compiled',
      'uploader',
      'uploaded',
      'deployer'
    ])
  }

  /** Compile this contract.
    *
    * If a valid binary is present and a rebuild is not requested,
    * this does not compile it again, but reuses the binary. */
  async compile ({
    compiler = this.compiler,
    rebuild  = false,
    ...buildOptions
  }: {
    compiler?: Compiler
    rebuild?: boolean
  } = {}): Promise<CompiledCode & Parameters<Compiler["build"]>[1] & {
    codeHash: CodeHash
  }> {
    return Impl.compile(this, ...args)
  }

  /** Upload this contract.
    *
    * If a valid binary is not present, compile it first.
    *
    * If a valid code ID is present and reupload is not requested,
    * this does not upload it again, but reuses the code ID.
    *
    * If a valid binary is not present, but valid source is present,
    * this compiles the source code first to obtain a binary. */
  async upload ({
    compiler = this.compiler,
    rebuild  = false,
    uploader = this.uploader,
    reupload = rebuild,
    ...uploadOptions
  }: Parameters<this["compile"]>[0] & Parameters<Agent["upload"]>[1] & {
    uploader?: Address|{ upload: Agent["upload"] }
    reupload?: boolean,
  } = {}): Promise<UploadedCode & {
    codeId: CodeId
  }> {
    return Impl.upload(this, ...args)
  }
}

/** A contract that is part of a deploment.
  * - needed for deployment-wide deduplication
  * - generates structured label */
export class Unit extends ContractLifecycle {
  /** Name of this unit. */
  name?:       string
  /** Deployment to which this unit belongs. */
  deployment?: Deployment
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash
  /** Code ID representing the identity of the contract's code on a specific chain. */
  chainId?:    ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId

  constructor (
    properties: ConstructorParameters<typeof ContractLifecycle>[0] & Partial<Unit> = {}
  ) {
    super(properties)
    assign(this, properties, [
      'name', 'deployment', 'isTemplate', 'codeHash', 'chainId', 'codeId', 
    ] as any)
  }

  serialize () {
    const { name, codeHash, chainId, codeId } = this
    return { name, codeHash, chainId, codeId }
  }
}

export class UploadUnit extends Unit {
  readonly isTemplate = true
  /** Create a new instance of this contract. */
  contract (
    name: Name, parameters?: Partial<InstantiateUnit>
  ): InstantiateUnit {
    return new InstantiateUnit({ ...this, name, ...parameters||{} })
  }
  /** Create multiple instances of this contract. */
  contracts (
    instanceParameters: Record<Name, Parameters<UploadUnit["contract"]>[1]> = {}
  ): Record<keyof typeof instanceParameters, InstantiateUnit> {
    const instances: Record<keyof typeof instanceParameters, InstantiateUnit> = {}
    for (const [name, parameters] of Object.entries(instanceParameters)) {
      instances[name] = this.contract(name, parameters)
    }
    return instances
  }
}

export class InstantiateUnit extends Unit {
  readonly isTemplate = false
  /** Full label of the instance. Unique for a given chain. */
  label?:    Label
  /** Address of this contract instance. Unique per chain. */
  address?:  Address
  /** Contents of init message. */
  initMsg?:  Into<Message>
  /** Address of agent that performed the init tx. */
  initBy?:   Address
  /** Native tokens to send to the new contract. */
  initSend?: Token.ICoin[]
  /** Fee to use for init. */
  initFee?:  unknown
  /** Instantiation memo. */
  initMemo?: string
  /** ID of transaction that performed the init. */
  initTx?:   TxHash
  /** Contents of init message. */
  initGas?:  unknown

  constructor (
    properties?: ConstructorParameters<typeof Unit>[0] & Partial<InstantiateUnit>
  ) {
    super(properties)
    assign(this, properties, [
      'label', 'address',
      'initMsg', 'initBy', 'initSend', 'initFee', 'initMemo', 'initTx', 'initGas'
    ])
  }

  async deploy ({
    deployer = this.deployer,
    redeploy = false,
    uploader = this.uploader||deployer,
    reupload = false,
    compiler = this.compiler,
    rebuild  = false,
    ...initOptions
  }: Parameters<this["upload"]>[0] & Parameters<Agent["instantiate"]>[0] & {
    deployer?: Address|{ instantiate: Agent["instantiate"] }
    redeploy?: boolean
  } = {}): Promise<InstantiateUnit & {
    address: Address
  }> {
    return Impl.instantiate(this, ...args)
  }

  serialize () {
    const {
      label, address, initMsg, initBy, initSend, initFee, initMemo, initTx, initGas
    } = this
    return {
      ...super.serialize(),
      label, address, initMsg, initBy, initSend, initFee, initMemo, initTx, initGas
    }
  }

  /** Returns a client to this contract instance. */
  connect (agent?: Agent):
    Contract
  connect <C extends typeof Contract> (
    agent?: Agent, $C: C = Contract as C
  ) {
    return new $C({
      ...this,
      agent,
    })
  }

  isValid (): this is InstantiateUnit & { address: Address } {
    return !!this.address
  }
}
