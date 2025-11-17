import type { Fn } from './function.ts';

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
  for (const key of keys) result[key] = (data[key] as Function).bind(data);
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
