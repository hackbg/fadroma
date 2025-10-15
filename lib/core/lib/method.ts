/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never
/** Slice off the 1st arg of every function */
export type ToApi<I> = {
  [k in keyof I]: I[k] extends (...args: infer R) => infer T
    ? Method<I[k]>
    : I[k]
};
/** Type of chain API implementation. */
export type Impl<A extends Api, D extends Context> = {
  [k in keyof A]: A[k] extends (...args: infer R) => infer T
    ? ((deps: D, ...args: R) => T)
    : never
};
