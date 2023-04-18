import type {
  Agent, Class, Chain, Buildable, Built, Uploaded, Instantiated, AnyContract, Name
} from '../index'
import { Error, Console, validated, hideProperties } from '../util'

import { assertAgent } from './Agent'
import { Contract } from './Deployment'

/** A constructor for a Client subclass. */
export interface ClientClass<C extends Client> extends Class<C, [
  Agent      |undefined,
  Address    |undefined,
  CodeHash   |undefined,
  Contract<C>|undefined
]>{}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {

  constructor (
    /** Agent that will interact with the contract. */
    public agent?:    Agent,
    /** Address of the contract on the chain. */
    public address?:  Address,
    /** Code hash confirming the contract's integrity. */
    public codeHash?: CodeHash,
    /** Contract class containing deployment metadata. */
    meta?:            Contract<any>
  ) {
    hideProperties(this, 'log', 'context')
    this.meta = (meta ?? new Contract()) as Contract<this>
    this.meta.address  ??= address
    this.meta.codeHash ??= codeHash
    this.meta.chainId  ??= agent?.chain?.id
    //if (!agent)    this.log.warnNoAgent(this.constructor.name)
    //if (!address)  this.log.warnNoAddress(this.constructor.name)
    //if (!codeHash) this.log.warnNoCodeHash(this.constructor.name)
  }

  meta: Contract<any>

  /** Logger. */
  log = new Console('@fadroma/agent: Client')

  /** Default fee for all contract transactions. */
  fee?: IFee = undefined

  /** Default fee for specific transactions. */
  fees?: Record<string, IFee> = undefined

  /** The chain on which this contract exists. */
  get chain (): Chain|undefined {
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

  get asInfo () {
    return this.meta.asInfo
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Agent|undefined = this.agent): this {
    if (!agent || agent === this.agent) return this
    const $C = this.constructor as ClientClass<typeof this>
    return new $C(agent, this.address, this.codeHash, this.meta) as this
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

/** @returns a string in the format `crate[@ref][+flag][+flag]...` */
export function getSourceSpecifier (meta: Buildable): string {
  const { crate, revision, features } = meta
  let result = crate ?? ''
  if (revision !== 'HEAD') result = `${result}@${revision}`
  if (features && features.length > 0) result = `${result}+${features.join('+')}`
  return result
}

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** @returns the code hash of the thing
  * @throws  LinkNoCodeHash if missing. */
export function assertCodeHash ({ codeHash }: { codeHash?: CodeHash } = {}): CodeHash {
  if (!codeHash) throw new Error.LinkNoCodeHash()
  return codeHash
}

/** Fetch the code hash by id and by address, and compare them.
  * @returns the passed contract object but with codeHash set
  * @throws if unable to establish the code hash */
export async function fetchCodeHash (
  meta:   Partial<Built> & Partial<Uploaded> & Partial<Instantiated>,
  agent?: Agent|null|undefined, expected?: CodeHash,
): Promise<CodeHash> {
  if (!agent) throw new Error.NoAgent()
  if (!meta.address && !meta.codeId && !meta.codeHash) {
    throw new Error('Unable to fetch code hash: no address or code id.')
  }
  const codeHashByAddress = meta.address
    ? validated('codeHashByAddress', await agent.getHash(meta.address), expected)
    : undefined
  const codeHashByCodeId  = meta.codeId
    ? validated('codeHashByCodeId',  await agent.getHash(meta.codeId),  expected)
    : undefined
  if (codeHashByAddress && codeHashByCodeId && codeHashByAddress !== codeHashByCodeId) {
    throw new Error('Validation failed: different code hashes fetched by address and by code id.')
  }
  if (!codeHashByAddress && !codeHashByCodeId) {
    throw new Error('Code hash unavailable.')
  }
  return codeHashByAddress! ?? codeHashByCodeId!
}

/** Objects that have a code hash in either capitalization. */
export type Hashed =
  | { code_hash: CodeHash }
  | { codeHash: CodeHash }

/** Allow code hash to be passed with either cap convention; warn if missing or invalid. */
export function codeHashOf (hashed: Hashed): CodeHash {
  let { code_hash, codeHash } = hashed as any
  if (typeof code_hash === 'string') code_hash = code_hash.toLowerCase()
  if (typeof codeHash  === 'string') codeHash  = codeHash.toLowerCase()
  if (code_hash && codeHash && code_hash !== codeHash) throw new Error.DifferentHashes()
  const result = code_hash ?? codeHash
  if (!result) throw new Error.NoCodeHash()
  return result
}

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** Retrieves the code ID corresponding to this contract's address/code hash.
  * @returns `this` but with `codeId` populated. */
export async function fetchCodeId <C extends AnyContract> (
  meta: C, agent: Agent, expected?: CodeId,
): Promise<CodeId> {
  return validated('codeId',
    String(await agent.getCodeId(assertAddress(meta))),
    (expected===undefined) ? undefined : String(expected)
  )
}

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** Options for a compute transaction. */
export interface ExecOpts {
  /** The maximum fee. */
  fee?:  IFee
  /** A list of native tokens to send alongside the transaction. */
  send?: ICoin[]
  /** A transaction memo. */
  memo?: string
  /** Allow extra options. */
  [k: string]: unknown
}

/** An address on a chain. */
export type Address = string

/** @returns the address of a thing
  * @throws  LinkNoAddress if missing. */
export function assertAddress ({ address }: { address?: Address|null } = {}): Address {
  if (!address) throw new Error.LinkNoAddress()
  return address
}

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  readonly amount: readonly ICoin[]
  constructor (amount: Uint128|number, denom: string, readonly gas: string = String(amount)) {
    this.amount = [{ amount: String(amount), denom }]
  }
}

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

/** Default fees for the main operations that an Agent can perform. */
export interface AgentFees {
  send?:   IFee
  upload?: IFee
  init?:   IFee
  exec?:   IFee
}

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export interface StructuredLabel {
  label?:  Label
  name?:   Name
  prefix?: Name
  suffix?: Name
}

/** A contract's full unique on-chain label. */
export type Label = string

export class StructuredLabel {

  constructor (
    public prefix?: string,
    public name?:   string,
    public suffix?: string,
  ) {}

  toString () {
    let name = this.name
    if (this.prefix) name = `${this.prefix}/${name}`
    if (this.suffix) name = `${name}+${this.suffix}`
    return name
  }

  static parse (label: string): StructuredLabel {
    const { prefix, name, suffix } = parseLabel(label)
    return new StructuredLabel(prefix, name, suffix)
  }

  static async fetch (address: Address, agent: Agent, expected?: Label): Promise<StructuredLabel> {
    return StructuredLabel.parse(await agent.getLabel(address))
  }

}

/** Fetch the label from the chain. */
export async function fetchLabel <C extends AnyContract> (
  contract: C, agent: Agent, expected?: Label
): Promise<Label> {
  const label = await agent.getLabel(assertAddress(contract))
  if (!!expected) validated('label', label, expected)
  Object.assign(contract, { label })
  try {
    const { name, prefix, suffix } = parseLabel(label)
    Object.assign(contract, { name, prefix, suffix })
  } catch (e) {}
  return label
}

/** RegExp for parsing labels of the format `prefix/name+suffix` */
export const RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

/** Parse a label into prefix, name, and suffix. */
export function parseLabel (label: Label): StructuredLabel {
  const matches = label.match(RE_LABEL)
  if (!matches || !matches.groups) throw new Error.InvalidLabel(label)
  const { name, prefix, suffix } = matches.groups
  if (!name) throw new Error.InvalidLabel(label)
  return { label, name, prefix, suffix }
}

/** Construct a label from prefix, name, and suffix. */
export function writeLabel ({ name, prefix, suffix }: StructuredLabel = {}): Label {
  if (!name) throw new Error.NoName()
  let label = name
  if (prefix) label = `${prefix}/${label}`
  if (suffix) label = `${label}+${suffix}`
  return label
}
/** A 128-bit integer. */
export type Uint128    = string

/** A 256-bit integer. */
export type Uint256    = string

/** A 128-bit decimal fraction. */
export type Decimal    = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** A moment in time. */
export type Moment   = number

/** A period of time. */
export type Duration = number

export function addZeros (n: number|Uint128, z: number): Uint128 {
  return `${n}${[...Array(z)].map(() => '0').join('')}`
}

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   assertAddress(instance),
  code_hash: codeHashOf(instance)
})

/** Objects that have an address and code hash.
  * Pass to linkTuple or linkStruct to get either format of link. */
export type IntoLink = Hashed & {
  address: Address
}

/** Reference to an uploaded smart contract, to be used by contracts. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}
