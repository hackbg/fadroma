import type { AnyContract } from './core-contract'
import type { Agent } from './core-agent'
import type { Contract } from './core-contract'
import type { Client } from './core-client'
import { assertAddress } from './core-tx'
import { validated } from './core-fields'
import { ClientError } from './core-events'

/** The friendly name of a contract, or another part of the label (prefix, suffix).
  * Names are user-specified and are used as the keys of `deployment.store`.
  * Prefix and suffix are set automatically to work around the label uniqueness constraint. */
export type Name = string

export type Named<T> = Record<Name, T>

export type ArrayOrNamed<T> = Array<T>|Named<T>

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export interface StructuredLabel {
  label?:  Label,
  name?:   Name,
  prefix?: Name,
  suffix?: Name
}

/** A contract's full unique on-chain label. */
export type Label  = string

/** Fetch the label from the chain. */
export async function fetchLabel <C extends AnyContract> (
  contract: C, agent: Agent, expected?: Label
): Promise<C & { label: Label }> {
  const label = await agent.getLabel(assertAddress(contract))
  if (!!expected) validated('label', expected, label)
  const { name, prefix, suffix } = parseLabel(label)
  return Object.assign(contract, { label, name, prefix, suffix })
}

/** RegExp for parsing labels of the format `prefix/name+suffix` */
export const RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

/** Parse a label into prefix, name, and suffix. */
export function parseLabel (label: Label): StructuredLabel {
  const matches = label.match(RE_LABEL)
  if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
  const { name, prefix, suffix } = matches.groups
  if (!name) throw new ClientError.InvalidLabel(label)
  return { label, name, prefix, suffix }
}

/** Construct a label from prefix, name, and suffix. */
export function writeLabel ({ name, prefix, suffix }: StructuredLabel = {}): Label {
  if (!name) throw new ClientError.NoName()
  let label = name
  if (prefix) label = `${prefix}/${label}`
  if (suffix) label = `${label}+${suffix}`
  return label
}
