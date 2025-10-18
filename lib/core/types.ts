/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;
/** Soft optional. */
export type Maybe<T> = T|Falsy;
/** String, or something with a `toString` method. */
export type Stringy = string|{ toString(): string };
/** 128-bit integer. */
export type Uint128 = number|string|bigint;
/** 256-bit integer. */
export type Uint256 = number|string|bigint;
/** 128-bit decimal fraction. */
export type Decimal128 = number|string;
/** 256-bit decimal fraction. */
export type Decimal256 = number|string;
/** Thing, or promise of thing. */
export type MaybeAsync<T> = T|Promise<T>;
/** Function that may or may not be async. */
export type MaybeAsyncFn<T> = (..._: unknown[])=>MaybeAsync<T>;

export type Step = <T, U = T> (_: T) => MaybeAsync<U>;

/** Output target, e.g. `process.stdout`. */
export type Write  = { write (...data: unknown[]): unknown };
/** Logging interface. */
export type Logger<I extends Id, L extends Console> = Identified<I> & { log: L };
/** Internal identifier. */
export type Id = string|number|bigint
/** Uniquely identified item. */
export type Identified<I extends Id> = { id: I };
/** Human-readable name. */
export type Name = string
/** Named item. */
export type Named = { /* The name. */ name: Name };
/** Human-readable info interface. */
export type Info = { summary (): string, details (): string };
/** Hash. */
export type Hash = string|Uint8Array;
/** Hashed item. */
export type Hashed = { /** The hash. */ hash: Hash };
/** Color. TODO specify representation */
export type Color = unknown;
/** Thing identifiable by color. */
export type Colorful = { /** The identifying color. */ color: Color };
/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };
/** TODO: Alias for various buffer types. */
export type Bytes = Uint8Array;
/** A valid JSON-RPC v2 response, which may be a result or an error. */
export type JsonRpcResponse<R> = {
  jsonrpc: string, id: number, result?: R, error?: { data: string }
};
/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];
/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never;
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
