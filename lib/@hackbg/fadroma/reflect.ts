import type { Named } from './format.ts';

/** Rename a function. */
export const renamed = <N extends Named> (name: string|Falsy, fn: N): N => {
  if (!name) return fn
  if (typeof name === 'string') return Object.defineProperty(fn, 'name', { configurable: true, value: name })
  throw new Error(`not a name: ${typeof name} ${name}`)
}

/** Rename a function and add metadata. */
export const reflect = <T>(name, fn, props: T = {}) =>
  Object.assign(renamed(name, fn), props);

/** Partial application of a function.
  * Use this to prepare a function with arguments for testing.
  *
  * See:
  *   - https://en.wikipedia.org/wiki/Currying
  *   - https://en.wikipedia.org/wiki/Partial_application
  * 
  * Example:
  *
  *     // A function with 2 arguments:
  *     const result = await fn(arg1, arg2)
  *     const check = result => ok(result > 0)
  *     check(result)
  *
  *     // Is tested like this:
  *     expect("description",
  *       curry(fn, arg1, arg2),
  *       check)
  */
export const curry = <F extends ((..._:unknown[])=>unknown)>(
  fn: F, ...args: Partial<Parameters<F>>
) => Object.assign(fn.bind(null, ...args), {
  fn, args, stack: new Error().stack?.split('\n').slice(3)
})

/** Point-free combinator: construct a callable pipeline of functions.
  *
  * When there's an async step in the pipeline,
  * the whole pipeline "becomes asynchronous"
  * and can be `await`ed as a whole.
  *
  * Example:
  *   const param = "hello"
  *   const op = pipe(f1, f2, f3);
  *
  *   equal(await op(p), f3(await f2(f1(p))));
  *
  *   function f1 (p) { ... }
  *   async function f2 (p) { ... }
  *   function f3 (p) { ... }
  **/
export const pipe = <X, Y, F extends (_: unknown)=>unknown> (
  ...steps: F[]
): Pipe<X, Y, F> => Object.assign(function pipe (value: X): Y {
  let state: unknown = value;
  for (const step of steps) state = resolveSync(state as unknown as X, step);
  return state as Y
}, { steps });

export type Pipe<X, Y, F> = ((_: X) => Y) & { steps: F[] };

/** Universal color-blind combinator.
  *
  * Works by checking if the return value
  * of the previous step is `then`able. */
export const resolveSync = <X, F extends (_: unknown)=>unknown> (
  x: X | { then?: (f: F)=>Promise<unknown> }, f: F
) => isThenable(x)
  ? (x as unknown as { then: (_:F)=>Promise<unknown> }).then(f)
  : f(x);

export const isThenable = (x: unknown) => !!x
  && (typeof x === 'object')
  && ('then' in x)
  && (typeof x.then === 'function');

/** Check the `typeof` a JS value. */
export const isType = (type: string) => Object.assign(function isType (value: any) {
  return type === typeof value
}, { type });

/** Check if the `typeof` a JS value is a function. */
export const isFn = isType('function')

/** Pick named keys from an object. */
export const pick = <T, K extends keyof T>(
  ...keys: Array<K>
) => Object.assign(function pickKeys (data: T): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = data[key];
  return result as Pick<T, K>;
}, { keys });

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

type Method<T> = (_: T, ...__: unknown[]) => unknown[]
