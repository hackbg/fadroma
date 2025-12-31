import { setImmediate, argv, fileURLToPath } from '../deps.ts';
import Async from './Async.ts';

export default Fn;

/** Gradually elaboratable function type. */
type Fn<Inputs extends unknown[] = unknown[], Output = unknown> =
  & Fn.Takes<Inputs>
  & Fn.Returns<Output>;

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

function Fn <F extends ((..._:unknown[])=>unknown)> (
  fn: F, ...args: Partial<Parameters<F>>
) {
  return Fn.Name(`${fn.name}(${curriedArgs(args)})`, fn.bind(null, ...args), {
    fn, args, stack: new Error().stack?.split('\n').slice(3)
  });
}
const curriedArgs = (args: unknown[]) => args.map(String)
  .map((x: string) => x==='undefined'?'_':x).join(', ');

namespace Fn {
  /** Function arguments. */
  export type Takes<T extends unknown[]> = (...args: T) => unknown;
  /** Function return type. */
  export type Returns<T> = (...args: unknown[]) => T;
  /** Annotations added by [Name]. */
  export type Reflects<F extends Fn[] = Fn[]> = { stack?: string[], steps?: F };
  /** Run functions sequentially in the same context,
    * ignoring return values. */
  export function Do <T> (...steps: Async<Takes<[T]>>[]) {
    return Name(null, async function doSequentially (context: T): Promise<T> {
      for (let i = 0; i < steps.length; i++) {
        const step = await steps[i];
        if (typeof step === 'function') await step(context);
      }
      return context;
    }, { steps });
  }
  /** Something that may have a `name`, such as a [Function]. */
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
  /** Composition of functions. */
  export type Pipe<Output = unknown, Inputs extends [] = []> = 
    Fn.Reflects & Fn<Inputs, Async<Output>>;
  /** Compose functions, passing the return value
    * of each step as first argument to next step.
    *
    * When there's an async step in the pipeline,
    * the pipeline transparently becomes asynchronous.
    *
    * Example:
    *   const param = "hello"
    *   const op = Fn.Pipe(f1, f2, f3);
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
  export function Pipe (): typeof Id;
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
    if (steps.length === 0) return Fn.Name('Pipe0', Id);
    if (typeof steps[0] === 'function') {
      return Fn.Name(pipeName(steps as Fn[]), function pipeline (value: unknown) {
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

  /** The identity function. */
  export const Id = <T>(x: T): T => x;

  /** The function that returns the identity function. */
  export const Nop = (..._: unknown[]) => Id;

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
  export const todo = (...info: string[]) => Fn.Name(info.join(' '),
    function trackTodo (_context: unknown) {
      throw Object.assign(new Error(info.join(' ')), { todo: true })
    }, { info, todo: true, skip: true });
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

  /** Run functions sequentially in the same context,
    * ignoring return values. */
  export function Seq (...steps: Async<Fn>[]) {
    return Fn.Name(null, async function runSequentially (context: unknown) {
      for (let i = 0; i < steps.length; i++) {
        const step = await steps[i];
        if (typeof step === 'function') await step(context);
      }
      return context;
    }, { steps });
  }

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
    *   import { Fn } from '@hackbg/fadroma';
    *   export default Fn.Main(import.meta.main || import.meta.url, main)
    *   async function main (...args: string[]) {
    *     console.log('Program arguments:', ...args)
    *   }
    *
    * */
  export function Main <M extends Fn> (meta: Main.Meta, main: M): M;
  export function Main <M extends Fn, N> (meta: Main.Meta, main: Main, alt: N): N;
  export function Main (
    meta: Main.Meta = {}, main: Fn<string[], unknown>, alt?: unknown
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

  export namespace Main {
    /** Used to recognize entrypoint. */
    export type Meta = Partial<ImportMeta>;
    /** Return true if the entrypoint matches. */
    export const is = function isMain (meta: boolean|Meta, argv1: string) {
      return (!(meta === false)) && (false
        || (meta === true)
        || (!!meta?.main)
        || (meta?.url && fileURLToPath(meta?.url) == argv1));
    };
  }
}
