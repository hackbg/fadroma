import type { Fn } from './function.ts';

export default Async;

/** Handle T or Promise<T> as Promise<T> */
type Async<T = unknown> =
  | T
  | Promise<T>;
/** Handle T or Promise<T> as Promise<T>
  *
  * Works by checking if the return value
  * of the previous step is `then`able. */
function Async <X, F extends (_: unknown)=>unknown> (
  x: X | { then?: (f: F)=>Promise<unknown> }, f: F
) { return Async.isThenable(x)
  ? (x as unknown as { then: (_:F)=>Promise<unknown> }).then(f)
  : f(x); }

namespace Async {
  /** Object with [Symbol.asyncIterator] method. */
  export type Iter<T> = { [Symbol.asyncIterator](): AsyncIterableIterator<T> };
  /** Add `Symbol.asyncIterator` to an object. */
  export const Iter = (getIter: Fn) => state => {
    const iter = getIter(state);
    return Object.assign(state, { [Symbol.asyncIterator]() { return iter } });
  };

  /** Create promise, Leaking `resolve` and `reject` methods
    * from the executor, which allows the promise
    * to be resolved from elsewhere. */
  export const defer = (callback?: Fn) => {
    let resolve: Fn, reject: Fn;
    const promise = new Promise((arg0, arg1)=>{
      resolve = arg0;
      reject  = arg1;
      if (callback) callback(resolve, reject);
    });
    return Object.assign(promise, { resolve, reject });
  }

  export const withCatcher =
    <T extends unknown[], U>(catcher: Fn<T, U>) =>
    <V extends unknown[], W>(f: Fn<V, W>) =>
    (...args: T): Async<W> =>
      Promise.resolve(f(...args)).catch(catcher) as Async<W>;

  export const isThenable = (x: unknown) => !!x
    && (typeof x === 'object')
    && ('then' in x)
    && (typeof x.then === 'function');
}
