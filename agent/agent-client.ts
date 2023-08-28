/**

  Fadroma: Base Contract Client
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

import type {
  Agent, Class, Chain, Buildable, Built, Uploaded, Instantiated, AnyContract, Name
} from './agent'
import { Error, Console, hideProperties, HEAD } from './agent-base'
import { assertAgent } from './agent-chain'
import { Contract } from './agent-deploy'

import { validated } from '@hackbg/over'

/** A constructor for a Client subclass. */
export interface ClientClass<C extends Client> extends Class<C, [Partial<C>, ...any]> {}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {
  log = new Console(this.constructor.name)
  /** Agent that will interact with the contract. */
  agent?:    Agent
  /** Address of the contract on the chain. */
  address?:  Address
  /** Code hash confirming the contract's integrity. */
  codeHash?: CodeHash
  /** Code ID for the contract's code. */
  codeId?:   CodeId
  /** Contract metadata. */
  meta:      Contract<any>
  /** Default fee for all contract transactions. */
  fee?:      IFee
  /** Default fee for specific transactions. */
  fees:      Record<string, IFee> = {}

  constructor (options: Partial<Client> = {}) {
    hideProperties(this, 'log', 'context')
    const agent = this.agent ??= options.agent
    const address = this.address ??= options.address
    const codeHash = this.codeHash ??= options.codeHash
    this.meta ??= options.meta ?? new Contract<this>({ address, codeHash, chainId: agent?.chain?.id })
  }

  /** The chain on which this contract exists. */
  get chain (): Chain|undefined {
    return this.agent?.chain
  }
  /** The contract represented in ICC format (`{address, code_hash}`) */
  get asContractLink (): ContractLink {
    return this.meta.asContractLink
  }
  /** The contract template represented in factory format (`{code_id, code_hash}`) */
  get asContractCode () {
    return this.meta.asContractCode
  }
  /** Fetch code hash from address.
    * @returns Promise<this> */
  async fetchCodeHash (expected: CodeHash|undefined = this.codeHash): Promise<this> {
    const codeHash =
      validated('codeHash', await assertAgent(this).getHash(assertAddress(this)), expected)
    return Object.assign(this, { codeHash })
  }
  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    return assertAgent(this).query(this, msg)
  }
  /** Execute a transaction on the specified contract as the specified Agent. */
  execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    assertAddress(this)
    opt.fee = opt.fee || this.getFee(msg)
    return assertAgent(this).execute(this, msg, opt)
  }
  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
    const fees = this.fees ?? {}
    const defaultFee = this.fee ?? this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) throw new Error.Invalid.Message()
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
  /** Use the specified fee table for all subsequent transactions by this Client. */
  withFees (fees: Record<string, IFee>): this {
    this.fees = fees
    return this
  }
  /** @returns a copy of this Client that will execute the transactions as a different Agent. */
  withAgent (agent: Agent|undefined = this.agent): this {
    if (!agent || agent === this.agent) return this
    const $C = this.constructor as ClientClass<typeof this>
    return new $C({ ...this, agent })
  }

  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new Error.Invalid.Value(kind, name, expected, actual)
  }
}

/** @returns a string in the format `crate[@ref][+flag][+flag]...` */
export function getSourceSpecifier (meta: Buildable): string {
  const { crate, revision, features } = meta
  let result = crate ?? ''
  if (revision !== HEAD) result = `${result}@${revision}`
  if (features && features.length > 0) result = `${result}+${features.join('+')}`
  return result
}

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** @returns the code hash of the thing
  * @throws if missing. */
export function assertCodeHash ({ codeHash }: { codeHash?: CodeHash } = {}): CodeHash {
  if (!codeHash) throw new Error.Missing.CodeHash()
  return codeHash
}

/** Fetch the code hash by id and by address, and compare them.
  * @returns the passed contract object but with codeHash set
  * @throws if unable to establish the code hash */
export async function fetchCodeHash (
  meta:   Partial<Built> & Partial<Uploaded> & Partial<Instantiated>,
  agent?: Agent|null|undefined, expected?: CodeHash,
): Promise<CodeHash> {
  if (!agent) throw new Error.Missing.Agent()
  if (!meta.address && !meta.codeId && !meta.codeHash) {
    throw new Error.Failed('Unable to fetch code hash: no address or code id.')
  }
  const codeHashByAddress = meta.address
    ? validated('codeHashByAddress', await agent.getHash(meta.address), expected)
    : undefined
  const codeHashByCodeId  = meta.codeId
    ? validated('codeHashByCodeId',  await agent.getHash(meta.codeId),  expected)
    : undefined
  if (codeHashByAddress && codeHashByCodeId && codeHashByAddress !== codeHashByCodeId) {
    throw new Error.Failed('Validation failed: different code hashes fetched by address and by code id.')
  }
  if (!codeHashByAddress && !codeHashByCodeId) {
    throw new Error.Missing.CodeHash()
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
  if (code_hash && codeHash && code_hash !== codeHash) throw new Error.Invalid.Hashes()
  const result = code_hash ?? codeHash
  if (!result) throw new Error.Missing.CodeHash()
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
  if (!address) throw new Error.Missing.Address()
  return address
}

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  amount: ICoin[] = []
  constructor (
    amount: Uint128|number, denom: string, public gas: string = String(amount)
  ) {
    this.add(amount, denom)
  }
  add = (amount: Uint128|number, denom: string) =>
    this.amount.push({ amount: String(amount), denom })
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
  if (!matches || !matches.groups) throw new Error.Invalid.Label(label)
  const { name, prefix, suffix } = matches.groups
  if (!name) throw new Error.Invalid.Label(label)
  return { label, name, prefix, suffix }
}

/** Construct a label from prefix, name, and suffix. */
export function writeLabel ({ name, prefix, suffix }: StructuredLabel = {}): Label {
  if (!name) throw new Error.Missing.Name()
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

