import { Format, Logs } from '../deps.ts'
export const Case = Format.Case

/** An unique string-based identifier. */
export type Id = string

/** A color. */
export type Color = unknown;

/** The name of a deployment unit. Used to generate contract label. */
export type Name = string

/** Represents a uniquely identifiable entity. */
export interface Entity {
  /** Unique identifier. */
  id:     Id
  /** Human-friendly name. */
  name?:  Name
  /** Identifying color. */
  color?: Color
}

export function assignColor (identity: Entity): Entity & { color: unknown } {
  identity.color = Logs.randomColor({ luminosity: 'dark', seed: identity.id })
  return identity as Entity & { color: unknown }
}

export interface LoggingEntity extends Entity {
  log: Logs.Console
}
