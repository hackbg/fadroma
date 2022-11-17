import type { AnyContract } from './core-contract'
import type { Agent }       from './core-agent'
import type { Contract }    from './core-contract'
import type { Client }      from './core-client'
import type { Name }        from './core-fields'
import { assertAddress } from './core-tx'
import { validated }     from './core-fields'
import { ClientError }   from './core-events'

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export interface StructuredLabel {
  label?:  Label
  id?:     Name
  prefix?: Name
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
  const { id, prefix, suffix } = parseLabel(label)
  return Object.assign(contract, { label, id, prefix, suffix })
}

/** RegExp for parsing labels of the format `prefix/name+suffix` */
export const RE_LABEL = /((?<prefix>.+)\/)?(?<id>[^+]+)(\+(?<suffix>.+))?/

/** Parse a label into prefix, id, and suffix. */
export function parseLabel (label: Label): StructuredLabel {
  const matches = label.match(RE_LABEL)
  if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
  const { id, prefix, suffix } = matches.groups
  if (!id) throw new ClientError.InvalidLabel(label)
  return { label, id, prefix, suffix }
}

/** Construct a label from prefix, id, and suffix. */
export function writeLabel ({ id, prefix, suffix }: StructuredLabel = {}): Label {
  if (!id) throw new ClientError.NoName()
  let label = id
  if (prefix) label = `${prefix}/${label}`
  if (suffix) label = `${label}+${suffix}`
  return label
}
