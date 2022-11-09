import { Task } from '@hackbg/komandi'
import { ClientConsole, ClientError } from './core-events'

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
  log = new ClientConsole(this.constructor.name)
  constructor (options: Partial<Metadata> = {}) {
    this.define(options as object)
  }
  /** Provide parameters for an existing instance.
    * @returns self with overrides from options */
  define <T extends this> (options: Partial<T> = {}): T {
    return override(this, options as object) as T
  }
  /** Define a task (lazily-evaluated async one-shot field).
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    return defineTask(name, cb, this as T)
  }
}

export function defineTask <T, U> (
  name: string, cb: (this: T)=>PromiseLike<U>, context?: T & { log?: ClientConsole }
): Task<T, U> {
  const task = new Task(name, cb, context as unknown as T)
  const [_, head, ...body] = (task.stack ?? '').split('\n')
  task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
  task.log = context?.log ?? task.log
  return task as Task<T, U>
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

export function rebind (target: object, source: object): typeof target {
  // if target is a function make its name writable
  if ('name' in source) Object.defineProperty(target, 'name', { writable: true })
  // copy properties
  for (let key in source) Object.assign(target, { [key]: source[key] })
  // copy prototype
  Object.setPrototypeOf(target, Object.getPrototypeOf(source))
  return target
}

/** Default fields start out as getters that point to the corresponding field
  * on the context; but if you try to set them, they turn into normal properties
  * with the provided value. */
export function defineDefault <T extends object, D extends object> (
  obj: T, defaults: D, name: keyof D
) {
  Object.defineProperty(obj, name, {
    enumerable: true,
    get () {
      return defaults[name]
    },
    set (v: D[keyof D]) {
      Object.defineProperty(self, name, { enumerable: true, value: v })
      return v
    }
  })
}
