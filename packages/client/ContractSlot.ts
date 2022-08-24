/** Reference to an instantiated smart contract.
  * May contain reference to the template from wich it was instantiated. */
export interface Instance {
  address:   Address
  codeHash?: CodeHash
  codeId?:   CodeId
  chainId?:  ChainId
  initTx?:   TxHash
  label?:    Label
  template?: Template
}
/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export class ContractLink {
  static fromInstance = (
    { address, codeHash }: { address: Address, codeHash?: CodeHash }
  ) => {
    if (!codeHash) throw new Error("Can't link to contract with no code hash")
    return new ContractLink(address, codeHash)
  }

  constructor (
    readonly address:   Address,
    readonly code_hash: CodeHash
  ) {}
}
import { Instance, Executor, CodeHash, Address, CodeId, IFee, Message, ExecOpts } from './Core'

/** Interface to a specific contract.
  * Subclass Client to add your contract-specific methods. */
export class Client implements Instance {
  constructor (
    readonly agent?: Executor,
    arg:             Address|Partial<ClientOpts> = {},
    hash?:           CodeHash
  ) {
    const className = this.constructor.name
    if (!agent) console.warn(
      `Creating ${className} without Agent. Transactions and queries not possible.`
    )
    if (typeof arg === 'string') {
      this.address  = arg
      this.codeHash = hash
    } else {
      this.address  = arg.address!
      if (!this.address) console.warn(
        `${className} created with no address. Transactions and queries not possible.`
      )
      this.name     = arg.name     ?? this.name
      this.label    = arg.label    ?? this.label
      this.codeHash = arg.codeHash ?? this.codeHash ?? hash
      if (!this.codeHash) console.warn(
        `${className} created with no code hash. await client.fetchCodeHash() to populate.`
      )
      this.codeId   = arg.codeId   ?? this.codeId
      this.fee      = arg.fee      ?? this.fee
      this.fees = Object.assign(this.fees||{}, arg.fees||{})
    }
  }
  /** Friendly name of the contract. */
  name?:     string
  /** The Chain on which this contract exists. */
  get chain () { return this.agent?.chain }
  /** Label of the contract on the chain. */
  label?:    string
  /** Address of the contract on the chain. */
  address:   Address
  /** Code hash representing the content of the contract's code. */
  codeHash?: CodeHash
  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    return ContractLink.fromInstance(this)
  }
  /** Code ID representing the identity of the contract's code. */
  codeId?:   CodeId
  /** Default fee for transactions. */
  fee?:      IFee
  /** Default fee for specific transactions. */
  fees:      Record<string, IFee> = {}
  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
    const defaultFee = this.fee || this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return this.fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) {
        throw new Error('Client#getFee: messages must have exactly 1 root key')
      }
      return this.fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }
  /** Execute a query on the specified contract as the specified Agent. */
  async query <U> (msg: Message): Promise<U> {
    this.assertOperational()
    return await this.agent!.query(this, msg)
  }
  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    this.assertOperational()
    opt.fee = opt.fee || this.getFee(msg)
    return await this.agent!.execute(this, msg, opt)
  }
  /** Fetch the label, code ID, and code hash from the Chain.
    * You can override this method to populate custom contract info from the chain on your client,
    * e.g. fetch the symbol and decimals of a token contract. */
  async populate (): Promise<this> {
    this.assertOperational()
    await Promise.all([
      this.fetchLabel(), this.fetchCodeId(), this.fetchCodeHash()
    ])
    return this
  }
  async fetchLabel (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const label = await this.agent!.getLabel(this.address)
    if (!!expected) this.assertCorrect('label', expected, label)
    this.label = label
    return this
  }
  async fetchCodeId (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const codeId = await this.agent!.getHash(this.address)
    if (!!expected) this.assertCorrect('codeId', expected, codeId)
    this.codeId = codeId
    return this
  }
  async fetchCodeHash (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const codeHash = await this.agent!.getHash(this.address)
    if (!!expected) this.assertCorrect('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }
  /** Create a copy of this Client with all transaction fees set to the provided value.
    * If the fee is undefined, returns a copy of the client with unmodified fee config. */
  withFee (fee: IFee|undefined): this {
    const Self = this.constructor as ClientCtor<typeof this, any>
    if (fee) {
      return new Self(this.agent, {...this, fee, fees: {}})
    } else {
      return new Self(this.agent, {...this, fee: this.fee, fees: this.fees})
    }
  }
  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Executor): this {
    const Self = this.constructor as ClientCtor<typeof this, any>
    return new Self(agent, { ...this })
  }
  /** Throw if trying to do something with no agent or address. */
  assertOperational () {
    const name = this.constructor.name
    if (!this.address) new Error(
      `${name} has no Agent and can't operate. Pass an address with "new ${name}(agent, ...)"`
    )
    if (!this.agent) new Error(
      `${name} has no address and can't operate. Pass an address with "new ${name}(agent, addr)"`
    )
  }
  /** Throw if fetched metadata differs from configures. */
  assertCorrect (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) {
      throw new Error(`Wrong ${kind}: ${name} was passed ${expected} but fetched ${actual}`)
    }
  }
}

/** Options when creating a Client. */
export interface ClientOpts extends Instance {
  name?: string
  fee?:  IFee
  fees?: Record<string, IFee>
}

/** Client constructor - used by functions which create user-specified Clients. */
export interface ClientCtor<C extends Client, O extends Instance> {
  new (agent?: Executor, options?: Address|Partial<O>, hash?: CodeHash): C
}

/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export class ContractLink {
  static fromInstance = (
    { address, codeHash }: { address: Address, codeHash?: CodeHash }
  ) => {
    if (!codeHash) throw new Error("Can't link to contract with no code hash")
    return new ContractLink(address, codeHash)
  }
  constructor (
    readonly address:   Address,
    readonly code_hash: CodeHash
  ) {}
}
import { Name, Instance, Address, Template, Message } from './Core'
import { Client, ClientCtor } from './Client'
import { TemplateSlot } from './Template'

export type IntoContractSlot = Name|Partial<Instance>

export class ContractSlot<C extends Client> {
  static E00 = () =>
    new Error("Tried to create ContractSlot with nullish value")
  static E01 = (value: string) =>
    new Error("No deployment, can't find contract by name: "+value)
  static E02 = (prefix: string, value: string) =>
    new Error("Deployment "+prefix+" doesn't have "+value)
  static E03 = () =>
    new Error("Contract not found. Try .getOrDeploy(template, init)")
  static E04 = () =>
    new Error("Expected an identity to be selected.")
  static E05 = () =>
    new Error("Expected a deployment to be selected.")
  static E07 = () =>
    new Error("Value is not Client and not a name.")
  static E08 = () =>
    new Error("No name.")
  constructor (
    value:   IntoContractSlot,
    $Client: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    context: DeployContext,
    task?:   DeployTask<unknown>
  ) {
    if (!value) throw ContractSlot.E00
    if (typeof value === 'string') {
      this.name = value
      if (!context.deployment) throw ContractSlot.E01(value)
      if (context.deployment.has(value)) this.value = context.deployment.get(value)!
    } else {
      this.value = value
    }
    this.Client ??= $Client
    if (this.value && (this.value as { address: Address }).address) {
      this.value = new this.Client(context.creator, this.value)
    }
    this.context ??= context
    this.task    ??= task
  }
  name?:   string
  Client:  ClientCtor<C, any>
  context: DeployContext
  task?:   DeployTask<unknown>
  /** Info about the contract that we have so far. */
  value:   Partial<Instance> = {}
  /** Here the ContractSlot pretends to be a Promise. That way,
    * a fully populated Instance is available synchronously if possible,
    * and a ContractSlot can also be awaited to populate itself. */
  then <Y> (
    resolved: (c: C)=>Y,
    rejected: (e: Error)=>never
  ): Promise<Y> {
    if (!(this.value instanceof this.Client)) throw ContractSlot.E03()
    return Promise.resolve(this.value).then(resolved, rejected)
  }
  async deploy (template: Template|TemplateSlot|IntoTemplateSlot, msg: Message): Promise<C> {
    if (this.task) {
      const value = `deploy ${this.name??'contract'}`
      Object.defineProperty(deployContract, 'name', { value })
      return this.task.subtask(deployContract)
    }
    return await deployContract.bind(this)()
    async function deployContract (this: ContractSlot<C>) {
      const { creator, deployment } = this.context
      if (!deployment) throw ContractSlot.E05()
      if (!this.name)  throw ContractSlot.E08()
      template = await new TemplateSlot(template, this.context).getOrUpload()
      console.info(
        'Deploy   ',    bold(this.name!),
        'from code id', bold(String(template.codeId  ||'(unknown)')),
        'hash',         bold(String(template.codeHash||'(unknown)'))
      )
      const instance = await this.context.deployment!.init(creator, template, this.name,  msg)
      const client = new this.Client(this.context.creator, instance)
      console.info(
        'Deployed ',    bold(this.name!), 'is', bold(client.address),
        'from code id', bold(String(template.codeId  ||'(unknown)'))
      )
      return this.value = client
    }
  }
  async getOrDeploy (template: Template|TemplateSlot|IntoTemplateSlot, msg: Message): Promise<C> {
    if (this.task) {
      const value = `get or deploy ${this.name??'contract'}`
      Object.defineProperty(getOrDeployContract, 'name', { value })
      return this.task.subtask(getOrDeployContract)
    }
    return await getOrDeployContract.bind(this)()
    async function getOrDeployContract (this: ContractSlot<C>) {
      if (this.value instanceof this.Client) {
        console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold(this.value.address))
        return this.value
      } else if (this.value && this.value.address) {
        this.value = new this.Client(this.context.creator, this.value)
        console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold((this.value as C).address))
        return this.value as C
      } else if (this.name) {
        if (!this.context.creator)    throw ContractSlot.E04()
        if (!this.context.deployment) throw ContractSlot.E05()
        return await this.deploy(template, msg)
      }
      throw ContractSlot.E07()
    }
  }
  async getOr (getter: ()=>C|Promise<C>): Promise<C> {
    if (this.task) {
      const value = `get or provide ${this.name??'contract'}`
      Object.defineProperty(getContractOr, 'name', { value })
      return this.task.subtask(getContractOr)
    }
    return await getContractOr.bind(this)()
    async function getContractOr () {
      return await Promise.resolve(getter())
    }
  }
  get (message: string = `Contract not found: ${this.name}`): C {
    if (this.name && this.context.deployment && this.context.deployment.has(this.name)) {
      const instance = this.context.deployment.get(this.name)
      const client   = new this.Client(this.context.creator, instance!)
      return client
    } else if (this.value) {
      const client = new this.Client(this.context.creator, this.value)
      return client
    } else {
      throw new Error(message)
    }
  }
}

/** Instantiates multiple contracts of the same type in one transaction.
  * For instantiating different types of contracts in 1 tx, see deployment.initVarious */
export class MultiContractSlot<C extends Client> {
  constructor (
    $Client: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    public readonly context: DeployContext,
  ) {
    this.Client = $Client
  }
  public readonly Client: ClientCtor<C, any>
  async deployMany (
    template:  Template|TemplateSlot|IntoTemplateSlot,
    contracts: DeployArgs[] = []
  ): Promise<C[]> {
    if (!this.context.creator)    throw ContractSlot.E04()
    if (!this.context.deployment) throw ContractSlot.E05()
    // Provide the template
    template = await new TemplateSlot(template, this.context).getOrUpload() as Template
    // Deploy multiple contracts from the same template with 1 tx
    let instances: Instance[]
    try {
      const creator = this.context.creator
      instances = await this.context.deployment.initMany(creator, template, contracts)
    } catch (e) {
      DeployLogger(console).deployManyFailed(e, template, contracts)
      throw e
    }
    // Return API client to each contract
    return instances.map(instance=>this.context.creator!.getClient(this.Client, instance))
  }
}

export type DeployArgs       = [Name, Message]
export type DeployArgsTriple = [Template, Name, Message]
