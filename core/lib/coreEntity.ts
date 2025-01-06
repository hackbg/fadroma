import { Format, Logs } from '../deps.ts'
export const Case = Format.Case

/** An unique string-based identifier. */
export type Id = string|number|bigint

/** A color. */
export type Color = unknown;

/** The name of a deployment unit. Used to generate contract label. */
export type Name = string

/** Represents a uniquely identifiable entity. */
export interface Entity<I extends Id> {
  /** Unique identifier. */
  id:     I
  /** Human-friendly name. */
  name?:  Name
  /** Identifying color. */
  color?: Color
}

export function assignColor <I extends Id> (identity: Entity<I>): Entity<I> & { color: unknown } {
  identity.color = Logs.randomColor({ luminosity: 'dark', seed: String(identity.id) })
  return identity as Entity<I> & { color: unknown }
}

export interface LoggingEntity<I extends Id, L extends Logs.Console> extends Entity<I> {
  log: L
}

/** Block hash. */
export type Hash = string
