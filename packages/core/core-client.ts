import type { Agent } from './core-agent'
import type { Class, Maybe } from './core-fields'
import type { Address, Message, ExecOpts } from './core-tx'
import type { CodeHash } from './core-code'
import type { IFee } from './core-fee'
import { assertAgent } from './core-agent'
import { assertAddress } from './core-tx'
import { validated } from './core-fields'
import { ClientConsole as Console, ClientError as Error } from './core-events'
import { Contract } from './core-contract'

/** A constructor for a Client subclass. */
export interface ClientClass<C extends Client> extends Class<C, ConstructorParameters<typeof Client>>{
  new (...args: ConstructorParameters<typeof Client>): C
  fromContract (contract: Contract<C>, agent?: Agent): C
}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {

  static fromContract <C extends Client> (
    contract: Contract<C>, agent: Maybe<Agent> = contract.agent
  ): C {
    return new this(agent, contract.address, contract.codeHash, contract) as C
  }

  constructor (
    /** Agent that will interact with the contract. */
    public agent?:    Agent,
    /** Address of the contract on the chain. */
    public address?:  Address,
    /** Code hash confirming the contract's integrity. */
    public codeHash?: CodeHash,
    /** Contract class containing deployment metadata. */
    meta?:     Contract<Client>
  ) {
    Object.defineProperty(this, 'log', { writable: true, enumerable: false })
    Object.defineProperty(this, 'context', { writable: true, enumerable: false })
    this.meta = (meta ?? new Contract()) as Contract<this>
    this.meta.address  ??= address
    this.meta.codeHash ??= codeHash
    this.meta.chainId  ??= agent?.chain?.id
    //if (!agent)    this.log.warnNoAgent(this.constructor.name)
    //if (!address)  this.log.warnNoAddress(this.constructor.name)
    //if (!codeHash) this.log.warnNoCodeHash(this.constructor.name)
  }

  meta: Contract<typeof this>

  /** Logger. */
  log = new Console('Fadroma.Client')

  /** Default fee for all contract transactions. */
  fee?: IFee = undefined

  /** Default fee for specific transactions. */
  fees?: Record<string, IFee> = undefined

  /** The chain on which this contract exists. */
  get chain () {
    return this.agent?.chain
  }

  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new Error.ValidationFailed(kind, name, expected, actual)
  }

  /** Fetch code hash from address. */
  async fetchCodeHash (expected: CodeHash|undefined = this.codeHash): Promise<this> {
    const codeHash = await assertAgent(this).getHash(assertAddress(this))
    return Object.assign(this, { codeHash: validated('codeHash', codeHash, expected) })
  }

  /** Legacy, use fetchCodeHash instead. */
  async populate (): Promise<this> {
    return await this.fetchCodeHash()
  }

  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    return this.meta.asLink
  }

  get asInfo (): ContractInfo {
    return this.meta.asInfo
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Agent|undefined = this.agent): this {
    if (!agent || agent === this.agent) return this
    const Client = this.constructor as ClientClass<typeof this>
    return new Client(agent, this.address, this.codeHash) as this
  }

  /** Creates another Client instance pointing to the same contract. */
  asClient <C extends Client> (client: ClientClass<C>): C {
    return new client(this.agent, this.address, this.codeHash, this.meta) as C
  }

  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    return assertAgent(this).query(this, msg)
  }

  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
    const fees       = this.fees ?? {}
    const defaultFee = this.fee ?? this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) throw new Error.InvalidMessage()
      return fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }

  /** Use the specified fee for all transactions by this Client. */
  withFee (fee: IFee): this {
    this.fee  = fee
    this.fees = {}
    return this
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    assertAddress(this)
    opt.fee = opt.fee || this.getFee(msg)
    return await assertAgent(this).execute(this, msg, opt)
  }

}
