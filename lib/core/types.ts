/** A thing, or a promise of a thing. */
export type MaybeAsync<T> = T|Promise<T>;
export type TaskStep<T> = (()=>T)|(()=>Promise<T>);
/** A string, or something with a `toString` method. */
export type Stringy = string|{ toString(): string };
/** 128-bit integer. */
export type Uint128 = number|string|bigint;
/** 256-bit integer. */
export type Uint256 = number|string|bigint;
/** 128-bit decimal fraction. */
export type Decimal128 = number|string;
/** 256-bit decimal fraction. */
export type Decimal256 = number|string;
/** An output target, such as `process.stdout`. */
export type Write  = { write (...data: unknown[]): unknown };
/** Logging interface. */
export type Logger<I extends Id, L extends Console> = Identified<I> & { log: L };

export type Id = string|number|bigint
export type Identified<I extends Id> = { id: I };

export type Name   = string
export type Named  = { name: Name };

export type Hash   = string;
export type Hashed = { hash: Hash };

/** A color. TODO specify representation */
export type Color = unknown;

/** A thing identifiable by color. */
export type Colorful = {
  /** The identifying color. */
  color: Color
};

export type Semver = string; // TODO
export type Versioned = { version: Semver };

export type Info = { summary (): string, details (): string };

export type Entity<I extends Id> = Identified<I> & Partial<Named & Colorful>;
/** A raw response from an endpoint. */
export type Response = {
  /** The query that was made. */
  url?:       string,
  /** The data that was returned, which may be invalid (e.g. a 502) */
  data?:      string
  /** The moment the query was made. */
  timestamp?: string,
};
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
