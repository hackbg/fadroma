import { setImmediate, argv, fileURLToPath } from '../deps.ts';

/** The identity function. */
export const identity = <T>(x: T): T => x;

/** Return the identity function. */
export const nop = (..._: unknown[]) => identity;

/** Something that may have a `name`. */
export type Name = { name: string };

/** Set the name of something. Optionally, assign metadata.
  *
  * * By default, the `name` property of functions is read-only,
  *   so this is accomplished using [Object.defineProperty].
  *
  * * Metadata added by this function is coped by descriptor,
  *   which means getters and setters will work as defined. */ 
export function Name <T, U> (name: string, named: T, props?: U): T & U & Name {
  // Rename function via property
  if (typeof name === 'string') named = Object.defineProperty(named, 'name', {
    configurable: true, value: name
  });
  // Copy properties via descriptors
  return Object.defineProperties(named, props
    ? Object.getOwnPropertyDescriptors(props)
    : {}) as T & U & Name;
}

/** Stub test step. When reached, terminates without passing or failing,
  * and adds a task to the test report.
  *
  * Example:
  *
  *     import { testSuite, expect, todo } from '@hackbg/fadroma';
  *     export default testSuite(import.meta,
  *       expect('Auto todo'),
  *       expect('Manual todo', todo()),
  *       expect('Manual todo with more info', todo('the more info')));
  *
  **/
export const todo = (...info: string[]) => Name(info.join(' '),
  function trackTodo (_context: unknown) {
    throw Object.assign(new Error(info.join(' ')), { todo: true })
  }, { info, todo: true, skip: true });

/** Used to recognize entrypoint. */
export type Meta = Partial<ImportMeta>;

/** A program's entrypoint. */
export type Main = Fn;

/** If the current module is the program entrypoint,
  * runs the given main function as a separate task.
  *
  * If the task throws, the error is logged and the process exits.
  * The exit code can be specified by the `exitCode` field of the
  * thrown exception. If not specified, it defaults to 1.
  *
  * Example:
  *
  *   import { Main } from '@hackbg/fadroma';
  *   export default Main(import.meta.main || import.meta.url, main)
  *   async function main (...args: string[]) {
  *     console.log('Program arguments:', ...args)
  *   }
  *
  * */
export function Main <M extends Fn> (meta: Meta, main: M): M;
export function Main <M extends Fn, N> (meta: Meta, main: Main, alt: N): N;
export function Main (
  meta: Partial<ImportMeta> = {},
  main: (args: string[])=>unknown,
  alt?: unknown
) {
  const [_, argv1, ...args] = argv
  if (Main.is(meta || {}, argv1)) setImmediate(async ()=>{
    try {
      await Promise.resolve(main(args));
      //exit(0);
    } catch (e) {
      const error = e as Error & { exitCode?: number };
      console.error('Main threw:', error);
      //exit(error.exitCode ?? 1);
    }
  })
  if (alt) return alt
  return main
}

Main.is = function isMain (meta: boolean|Partial<ImportMeta>, argv1: string) {
  return (!(meta === false)) && (false
    || (meta === true)
    || (!!meta?.main)
    || (meta?.url && fileURLToPath(meta?.url) == argv1));
}

/** Handle T or Promise<T> as Promise<T> */
export type Async<T = unknown> = T|Promise<T>;
/** Handle T or Promise<T> as Promise<T>
  *
  * Works by checking if the return value
  * of the previous step is `then`able. */
export const Async = <X, F extends (_: unknown)=>unknown> (
  x: X | { then?: (f: F)=>Promise<unknown> }, f: F
) => isThenable(x)
  ? (x as unknown as { then: (_:F)=>Promise<unknown> }).then(f)
  : f(x);

/** Gradually elaboratable function type. */
export type Fn<Inputs extends unknown[] = unknown[], Output = unknown> =
  Fn.Takes<Inputs> & Fn.Returns<Output>;
export namespace Fn {
  /** Function arguments. */
  export type Takes<T extends unknown[]> = (...args: T) => unknown;
  /** Function return type. */
  export type Returns<T> = (...args: unknown[]) => T;
  /** Annotations added by [Name]. */
  export type Reflects<F extends Fn[] = Fn[]> = { stack?: string[], steps?: F };
}
/** A sequence of functions. */
export type Pipe<Output, Inputs extends []> = 
  Fn.Reflects & Fn<Inputs, Async<Output>>;
/** Part of a [Pipe]. */
export type Step<T = unknown, U = T> =
  Fn.Reflects & Fn.Takes<[T]> & Fn.Returns<Async<U>>;
/** Add originating test step to stack trace.
  *
  * Since there is a degree of indirection involved when composing functions
  * (the code is defined from one place but executed from another),
  * without this helper the real stack would be lost. */
export function Step (
  step: { name?: string, stack?: string[] }, error: Error
) {
  if (typeof error !== 'object') error = new Error(error);
  error.stack ||= ''
  if (step.stack) error.stack += '\n  From:\n' + step.stack.join('\n')
  return error
}
/** A function that composes multiple steps into one step. */
export type Steps<T = unknown, U = T> =
  (...steps: Step<T>[])  => Step<T, U>;
/** A function that composes multiple steps and adds an annotation. */
export type StepsWith<X = unknown, T = unknown, U = T> =
  (_: X, ...steps: Step<T>[]) => Step<T, U>;

export function merged <T> (t: T): T;
export function merged <T, U> (t: T, u: U): T & U;
export function merged <T, U, V> (t: T, u: U, v: V): T & U & V;
export function merged <T, U, V, W> (t: T, u: U, v: V, w: W): T & U & V & W;
export function merged <T> (..._: Partial<T>[]): T;
export function merged <T> (...fragments: Partial<T>[]): T {
  return Object.assign(...fragments.filter(Boolean) as [object], {}) as T;
}

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
export function Fn <F extends ((..._:unknown[])=>unknown)> (
  fn: F, ...args: Partial<Parameters<F>>
) {
  return Name(`${fn.name}(${curriedArgs(args)})`, fn.bind(null, ...args), {
    fn, args, stack: new Error().stack?.split('\n').slice(3)
  });
}

const curriedArgs = (args: unknown[]) => args.map(String)
  .map((x: string) => x==='undefined'?'_':x).join(', ');

/** Combine functions, passing return value of each step
  * as first argument to next step.
  *
  * When there's an async step in the pipeline,
  * the pipeline transparently becomes asynchronous.
  *
  * Example:
  *   const param = "hello"
  *   const op = Pipe(f1, f2, f3);
  *
  *   equal(await op(p), f3(await f2(f1(p))));
  *
  *   function f1 (p) { ... }
  *   async function f2 (p) { ... }
  *   function f3 (p) { ... }
  *
  * TODO: Use conditional typing to support passing non-function
  *       as first argument, resulting in immediate evaluation.
  **/
export function Pipe (): typeof identity;
export function Pipe <Z> (z: Z): Z;
export function Pipe <Y, Z> (y: Y, z: Z):
  Z extends (_: infer B) => infer C ?
  Y extends (_: infer A) => B ? Fn<[A], C> : C : never;
export function Pipe <X, Y, Z> (x: X, y: Y, z: Z):
  Z extends (_: infer C) => infer D ?
  Y extends (_: infer B) => C ?
  X extends (_: infer A) => B ? Fn<[A], D> : D : never : never;
export function Pipe <W, X, Y, Z> (w: W, x: X, y: Y, z: Z):
  Z extends (_: infer D) => infer E ?
  Y extends (_: infer C) => D ?
  X extends (_: infer B) => C ?
  W extends (_: infer A) => B ? Fn<[A], E> : E : never : never : never;
export function Pipe (...steps: Fn[]): Fn;
export function Pipe (...steps: unknown[]) {
  if (steps.length === 0) return Name('Pipe0', identity);
  if (typeof steps[0] === 'function') {
    return Name(pipeName(steps as Fn[]), function pipeline (value: unknown) {
      for (const step of steps) {
        if (!step) continue;
        if (typeof step === 'function') value = Async(value, step as Fn);
      }
      return value
    }, { steps });
  }
  let value = steps.shift();
  for (const step of steps) {
    if (!step) continue;
    if (typeof step === 'function') value = Async(value, step as Fn);
  }
  return value
}
const pipeName = (steps: Fn[]): string =>
  `Pipe${steps.length}(${steps.map(x=>x?.name||'unnamed').join('|')})`

/** Run functions sequentially in the same context,
  * ignoring return values. */
export function Seq (...steps: Async<Fn>[]) {
  return Name(null, async function runSequentially (context: unknown) {
    for (let i = 0; i < steps.length; i++) {
      const step = await steps[i];
      if (typeof step === 'function') await step(context);
    }
    return context;
  }, { steps });
}

const isThenable = (x: unknown) => !!x
  && (typeof x === 'object')
  && ('then' in x)
  && (typeof x.then === 'function');

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
  const pipeline = Pipe(...steps);
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) result[key] = await pipeline(data[key], data) as T[K];
  return result as Pick<T, K>;
}, { keys, steps });

/** Shallow clone except certain keys. */
export const Omit = todo();

/** Specify a binary condition. */
export const when = (condition: boolean, ...fns: Step<unknown>[]) =>
  either(condition, Pipe(...fns));

/** Specify a ternary condition. */
export const either = <C> (
  condition:  boolean|((_: C)=>Async<boolean>),
  whenTrue:   Fn.Takes<[C]>,
  whenFalse?: Fn.Takes<[C]>
) => Object.assign(async function branch (state: C) {
  if (typeof condition === 'function') condition = await condition(state);
  if (condition) return whenTrue(state);
  if (whenFalse) return whenFalse(state);
}, { condition, whenTrue, whenFalse });

/** Create promise, Leaking `resolve` and `reject` methods
  * from the executor, which allows the promise
  * to be resolved from elsewhere. */
export const defer = (callback?: Function) => {
  let resolve: Function, reject: Function;
  const promise = new Promise((arg0, arg1)=>{
    resolve = arg0;
    reject  = arg1;
    if (callback) callback(resolve, reject);
  });
  return Object.assign(promise, { resolve, reject });
}

/** Object with Symbol.asyncIterator method. */
export type AsyncIter<T> = {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>
};

/** Add `Symbol.asyncIterator` to an object. */
export const AsyncIter = getIter => state => {
  const iter = getIter(state);
  return Object.assign(state, { [Symbol.asyncIterator]() { return iter } });
};

export const withCatcher =
  <T extends unknown[], U>(catcher: Fn<T, U>) =>
  <V extends unknown[], W>(f: Fn<V, W>) =>
  (...args: T): Async<W> =>
    Promise.resolve(f(...args)).catch(catcher) as Async<W>;

export const setProp = <T extends object>(key: keyof T, ...fns: Fn[]) =>
  Name(`set ${String(key)}`, async function setProperty (context) {
    return Object.assign(context, { [key]: await Pipe(...fns)(context) });
  }, { key, fns });

//type Method<T> = (_: T, ...__: unknown[]) => unknown[]

export type Prototype = { [Symbol.hasInstance] (_: unknown): boolean };
