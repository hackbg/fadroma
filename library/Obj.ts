import Fn from './Fn.ts';

/** Slice off the 1st arg of every function */
export type ToApi<I> = {
  [f in keyof I]: I[f] extends (...args: infer _I) => infer _O ? Method<I[f]> : I[f]
};

/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never;

/** Type of chain API implementation. */
export type Impl<Api, Context> = {
  [f in keyof Api]: Api[f] extends (...args: infer R) => infer T
    ? ((context: Context, ...args: R) => T)
    : never };

/** Pick named methods from an object, ensuring `this` bindings. */
export const pickMethods = <T, K extends keyof T>(
  keys: Array<K>, ...steps: Fn<[K]>[]
) => Object.assign(function pickKeys (data: T): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = (data[key] as Fn).bind(data);
  return result as Pick<T, K>;
}, { keys, steps });

/** Construct a new "static object" (i.e. without prototypes)
  * out of method collections and base object. */
export const bindMethods = <T extends object> (
  ...apis: Array<Record<string, Method<T>>>
) => Object.assign(function bindMethodsTo (state: T) {
  return Object.assign(state, ...apis.map(api=>mapApi(state)(api)))
}, { apis });

/** Bind methods from an API object to a state. */
export const mapApi = <T> (state: T) =>
  mapEntries((name, method: Method<T>)=>[
    name, (...args: unknown[]) => method(state, ...args)]);

/** Transform an object using a function
  * `(key, value, index) => newValue`. */
export const mapEntries = <T extends object> (
  fn: (k: keyof T, v: T[typeof k], i: number) => unknown
) => (obj: T) => Object.fromEntries(Object.entries(obj)
  .map(([k, v], i)=>[k, fn(k as keyof T, v, i)]))

/** Define a reducer for object entries. */
const _objectReducer = (f) => (a, [k, v]) =>
  Object.assign(a, { [k]: f(v, k) });

/** Apply an object reducer to an object's entries. */
const _reduceObject = f => x => Object.entries(x).reduce(f, {});

/** Check the `typeof` a JS value. */
const isType = (type: string) =>
  Object.assign(function isType (value: any) {
    return type === typeof value as string
  }, { type });

/** Check if the `typeof` a JS value is a function. */
const isFn = isType('function')

/** Shallow clone only certain keys. */
export const Pick = <T, K extends keyof T>(
  keys: Array<K>, ...steps: Fn<[T[K], T]>[]
) => Object.assign(async function pickKeys (data: T) {
  const pipeline = Fn.Pipe(...steps);
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = await pipeline(data[key], data) as T[K];
  return result as Pick<T, K>;
}, { keys, steps });

/** Shallow clone except certain keys. */
export const Omit = Fn.todo();

/** Specify a binary condition. */
export const when = (condition: boolean, ...fns: Fn.Step<unknown>[]) =>
  either(condition, Fn.Pipe(...fns));

/** Specify a ternary condition. */
export const either = <C> (
  condition:  boolean|((_: C)=>Fn.Async<boolean>),
  whenTrue:   Fn.Takes<[C]>,
  whenFalse?: Fn.Takes<[C]>
) => Object.assign(async function branch (state: C) {
  if (typeof condition === 'function') condition = await condition(state);
  if (condition) return whenTrue(state);
  if (whenFalse) return whenFalse(state);
}, { condition, whenTrue, whenFalse });

export const setProp = <T extends object>(key: keyof T, ...fns: Fn[]) =>
  Fn.Name(`set ${String(key)}`, async function setProperty (context) {
    return Object.assign(context, { [key]: await Fn.Pipe(...fns)(context) });
  }, { key, fns });

//type Method<T> = (_: T, ...__: unknown[]) => unknown[]

export type Prototype = { [Symbol.hasInstance] (_: unknown): boolean };

export function merged <T> (t: T): T;
export function merged <T, U> (t: T, u: U): T & U;
export function merged <T, U, V> (t: T, u: U, v: V): T & U & V;
export function merged <T, U, V, W> (t: T, u: U, v: V, w: W): T & U & V & W;
export function merged <T> (..._: Partial<T>[]): T;
export function merged <T> (...fragments: Partial<T>[]): T {
  return Object.assign(...fragments.filter(Boolean) as [object], {}) as T;
}
