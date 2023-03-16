import Error   from './Error'
import Console from './Console'

import type { Contract, AnyContract } from './Contract'

import type { Agent } from './Agent'
import type { Client } from './Client'

import type { Address } from './Tx'
import { assertAddress } from './Tx'

import { validated } from './Fields'
import type { Name } from './Fields'

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
