import type { Falsy, Testing } from './index.ts';
/** Used to recognize entrypoint. */
export type Meta = Partial<ImportMeta>;
/** A program's entrypoint. */
export type Main = Fn;
/** Either `T` or `Promise<T>`; both cases handled asynchronously. */
export type Async<T = unknown> = T|Promise<T>;
/** Function arguments. */
export type Takes<T extends unknown[]> = (...args: T) => unknown;
/** Function return type. */
export type Returns<T> = (...args: unknown[]) => T;
/** Annotations added by [reflect]. */
export type Reflects<F extends Fn[] = Fn[]> = { stack?: string[], steps?: F };
/** Procedure. Mutates context and returns void or new context. */
export type Op<T> = Takes<[T]> & Returns<Async<T|void>>;
/** Gradually elaboratable function type. */
export type Fn<Inputs extends unknown[] = unknown[], Output = unknown> =
  & Takes<Inputs> & Returns<Output>;
/** A sequence of functions. */
export type Pipe<Output, Inputs extends []> = 
  Reflects & Fn<Inputs, Async<Output>>;
/** Part of a [Pipe]. */
export type Step<T = unknown, U = T> =
  Reflects & Takes<[T]> & Returns<Async<U>>;
/** A function that composes multiple steps into one step. */
export type Steps<T = unknown, U = T> =
  (...steps: Step<T>[])  => Step<T, U>;
/** A function that composes multiple steps and adds an annotation. */
export type StepsWith<X = unknown, T = unknown, U = T> =
  (_: X, ...steps: Step<T>[]) => Step<T, U>;
/** Start time and duration. */
export type Timed = {
  /** Starting time in milliseconds. */
  t0?: number,
  /** Duration in milliseconds. */
  tD?: number,
};

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

/** Rename a function.
  *
  * By default, the `name` property of functions is read-only,
  * so this is accomplished using [Object.defineProperty]. */
export const renamed = <N extends { name: string }> (name: string|Falsy, fn: N): N => {
  if (!name) return fn
  if (typeof name === 'string') return Object.defineProperty(fn, 'name', { configurable: true, value: name })
  throw new Error(`not a name: ${typeof name} ${name}`)
}

/** Rename a function and add metadata. */
export const reflect = <T>(name, fn, props?: T) =>
  Object.assign(renamed(name, fn), props);

/** The identity function.
  *
  * Works great as a NOP when you need one. */
export const identity = <T>(x: T): T => x;

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

export { curry as call }

/** Combine functions, where the return value of each step
  * is passed as first argument to the next one.
  *
  * When there's an async step in the pipeline,
  * the pipeline transparently becomes asynchronous.
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
export const pipe = <Result, Input = unknown> (
  step0: Fn<[Input]>, ...steps: Fn[]
): Fn<[Result]> => reflect(
  `pipe ${steps.length+Number(!!step0)}`,
  function pipe (value: Input): Async<Output> {
    let state: unknown = value;
    for (const step of steps) state = resolveSync(state as unknown as X, step);
    return state as Y
  }, { steps });

export const sequence = <T>(...steps: Fn<[T]>[]) => reflect(null,
  async function runSequentially (context: T) {
    for (const step of steps) {
      if (!step) continue;
      await step(context)
    }
    return context;
  }, { steps });

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
  keys: Array<K>, ...steps: Fn<[T[K], T]>[]
) => Object.assign(async function pickKeys (data: T) {
  const pipeline = pipe(...steps);
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = await pipeline(data[key], data) as T[K];
  return result as Pick<T, K>;
}, { keys, steps });

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

/** Specify a binary condition. */
export const when = (condition: boolean, ...fns: Step<unknown>[]) =>
  either(condition, pipe(...fns));

/** Specify a ternary condition. */
export const either = <C> (
  condition:  boolean|((_: C)=>Async<boolean>),
  whenTrue:   Takes<[C]>,
  whenFalse?: Takes<[C]>
) => Object.assign(async function branch (state: C) {
  if (typeof condition === 'function') condition = await condition(state);
  if (condition) return whenTrue(state);
  if (whenFalse) return whenFalse(state);
}, { condition, whenTrue, whenFalse });

/** Define a reducer for object entries. */
export const objectReducer = (f) => (a, [k, v]) =>
  Object.assign(a, { [k]: f(v, k) });

/** Apply an object reducer to an object's entries. */
export const reduceObject = f => x => Object.entries(x).reduce(f, {});

/** Leak the resolve and reject methods of a promise
  * out of the promise executor, allowing the promise
  * to be resolved from elsewhere. */
export const defer = (callback?) => {
  let resolve, reject;
  const promise = new Promise((arg0, arg1)=>{
    resolve = arg0;
    reject  = arg1;
    if (callback) callback(resolve, reject);
  });
  return Object.assign(promise, { resolve, reject });
  return promise
}

export const interval =
  (msec: number, ...steps: Step[]) =>
    reflect(null, async function interval (..._: unknown[]) {
      return setInterval(() => {
        pipe(...steps)(performance.now())
      }, msec);
    }, { msec });

export type AsyncIter<T> = {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>
};

export const asyncIter = getIter => state => {
  const iter = getIter(state);
  return Object.assign(state, { [Symbol.asyncIterator]() { return iter } });
};

export const withCatcher =
  <T extends unknown[], U>(catcher: Fn<T, U>) =>
  <V extends unknown[], W>(f: Fn<V, W>) =>
  (...args: T): Async<W> =>
    Promise.resolve(f(...args)).catch(catcher) as Async<W>;

/** Stub test step. When reached, terminates without passing or failing,
  * and adds a task to the test report.
  *
  * Example:
  *
  *     import { suite, expect, todo } from '@hackbg/fadroma';
  *     export default suite(import.meta,
  *       expect('Auto todo'),
  *       expect('Manual todo', todo()),
  *       expect('Manual todo with more info', todo('the more info')));
  *
  **/
export const todo = (...info: string[]) => reflect(info.join(' '),
  function trackTodo <T extends Testing>(_context: T) {
    throw Object.assign(new Error(info.join(' ')), { todo: true })
  }, { info });

export const required = <T>(...info: string[]): T => {
  throw new Error('Missing required value: ' + info.join(' '));
}

export const requiredLate = (...info: string[]) => () => {
  throw new Error('Missing required value: ' + info.join(' '));
}


export const setProp = <T extends object>(key: keyof T, ...fns: Fn[]) =>
  reflect(`set ${String(key)}`, async function setProperty (context) {
    return Object.assign(context, { [key]: await pipe(...fns)(context) });
  }, { key, fns });

//type Method<T> = (_: T, ...__: unknown[]) => unknown[]
