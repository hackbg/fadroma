import { ClientError } from './client-events'
import type { Agent } from './client-connect'
import type { ContractTemplate, ContractInstance, StructuredLabel } from './client-contract'
import type { Builder, Uploader } from './client-deploy'

export function getMaxLength (strings: string[]): number {
  return Math.max(...strings.map(string=>string.length))
}

export function hide (self: object, keys: string[]): void {
  for (const key of keys) Object.defineProperty(self, key, { enumerable: false, writable: true })
}

/** A class constructor. */
export interface Class<T, U extends Array<unknown>> {
  new (...args: U): T
}

/** A class constructor for an extensible value object. */
export interface Overridable<T, U> extends Class<T, [Partial<T>?]|[U|Partial<T>, Partial<T>?]> {
}

export class Metadata {
  constructor (options: Partial<Metadata> = {}) {
    this.provide(options as object)
  }
  /** Provide parameters for an existing instance.
    * @returns self with overrides from options */
  provide <T extends this> (options: Partial<T> = {}): T {
    return override(this, options as object) as T
  }
}

/** Check if `obj` has a writable, non-method property of name `key` */
export function hasField <T extends object> (obj: T, key: keyof typeof obj): boolean {
  const exists = key in obj
  const descriptor = Object.getOwnPropertyDescriptor(obj, key) ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), key)
  const isWritable = descriptor?.writable ?? true
  const isGetter   = descriptor?.get ?? false
  const isFunction = (typeof obj[key as keyof T] === 'function') && !((obj[key as keyof T] as unknown as Function).prototype)
  return exists && isWritable && !isFunction && !isGetter
}

/** Set fields of first argument to values from second argument,
  * intelligently avoiding non-existent, read-only and method fields.
  * Opposite of `fallback`. */
export function override <T extends object> (obj: T, options: Partial<T> = {}): T {
  for (const [key, val] of Object.entries(options)) {
    if (val === undefined) continue
    if (hasField(obj, key as keyof T)) Object.assign(obj, { [key]: val })
  }
  return obj
}

/** Sets fields of first argument to values from second argument,
  * intelligently avoiding non-existent, read-only and method fields -
  * but only if the field is not already set. Opposite of `override`. */
export function fallback <T extends object> (obj: T, options: Partial<T> = {}): T {
  for (const [key, val] of Object.entries(options)) {
    if (val === undefined) continue
    const val2 = obj[key as keyof T] as any
    if (hasField(obj, key as keyof T)) Object.assign(obj, { [key]: val ?? val2 })
  }
  return obj
}

/** Throw if fetched metadata differs from configured. */
export function validated <T> (kind: string, value: T, expected?: T): T {
  if (typeof value === 'string' && typeof expected === 'string') {
    value = value.toLowerCase() as unknown as T
  }
  if (typeof expected === 'string') {
    expected = expected.toLowerCase() as unknown as T
  }
  if (typeof expected !== 'undefined' && expected !== value) {
    throw new ClientError.ValidationFailed(kind, '', expected, value)
  }
  return value
}

/** A lazily provided value. The value can't be a Function. */
export type Into<X> =
  | X
  | PromiseLike<X>
  | (()=>X)
  | (()=>PromiseLike<X>)

/** Resolve a lazily provided value. */
export async function into <X, Y> (specifier: Into<X>, context?: Y): Promise<X> {
  if (typeof specifier === 'function') {
    if (context) specifier = specifier.bind(context)
    return await Promise.resolve((specifier as Function)())
  }
  return await Promise.resolve(specifier)
}

/** A lazily provided array of lazily provided values. */
export type IntoArray<X> = Into<Array<Into<X>>>

/** Resolve a lazy array. */
export async function intoArray <X, Y> (specifier: IntoArray<X>, context?: Y): Promise<X[]> {
  specifier = await into(specifier)
  return await Promise.all((specifier as Array<Into<X>>).map(x=>into(x, context)))
}

/** A lazily provided record of lazily provided values. */
export type IntoRecord<X extends string|number|symbol, Y> = Into<Record<X, Into<Y>>>

/** Resolve a lazy record. */
export async function intoRecord <X extends string|number|symbol, Y, Z> (
  specifier: IntoRecord<X, Y>, context?: Z
): Promise<Record<X, Y>> {
  specifier = await into(specifier)
  const entries:  [X, Into<Y>][] = Object.entries(specifier) as [X, Into<Y>][]
  const resolved: Y[]            = await Promise.all(entries.map(entry=>into(entry[1])))
  const results:  Record<X, Y>   = {} as Record<X, Y>
  for (const index in resolved) {
    const [key] = entries[index]
    const result = resolved[index]
    results[key] = result
  }
  return results
}
