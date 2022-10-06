import { ClientError } from './client-events'
import type { Agent } from './client-connect'
import type { ContractTemplate, ContractInstance, StructuredLabel } from './client-contract'
import type { Builder, Uploader } from './client-deploy'

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
  /** Provide parameters for an existing contract.
    * @returns the modified contract. */
  provide <T extends this> (options: Partial<T>): T {
    return override(this, options as object) as T
  }
}

/** Implements some degree of controlled extensibility for the value object pattern used below.
  * @todo ..... underlay (converse function which provides defaults for defined properties
  * but leaves untouched ones that are already set rather than overriding them) */
export function override <T extends object> (self: T, options: Partial<T> = {}): T {
  for (const [key, val] of Object.entries(options)) {
    if (val === undefined) continue
    const exists     = key in self
    const writable   = Object.getOwnPropertyDescriptor(self, key)?.writable ?? true
    const isFunction = (typeof self[key as keyof T] === 'function')
    if (exists && writable && !isFunction) Object.assign(self, { [key]: val })
  }
  return self
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

export type IntoArray<X> = Into<Array<Into<X>>>

export async function intoArray <X, Y> (specifier: IntoArray<X>, context?: Y): Promise<X[]> {
  if (typeof specifier === 'function') {
    if (context) specifier = specifier.bind(context)
    specifier = await Promise.resolve((specifier as Function)())
  }
  return await Promise.all((specifier as Array<Into<X>>).map(x=>into(x, context)))
}
