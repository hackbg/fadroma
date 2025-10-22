export * from './format/number.ts';
export * from './format/string.ts';
export * from './format/color.ts';
export * from './format/error.ts';
export * from './format/logger.ts';

/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;

/** Soft optional. */
export type Maybe<T> = T|Falsy;

export type Num = number|string|bigint;

/** Unsigned integer of fixed bitness. */
export type Uint<B extends number> = { __bits: B } & Num;
export type Uint64  = Uint<64>;  // deprecated
export type Uint128 = Uint<128>; // deprecated
export type Uint256 = Uint<256>; // deprecated

/** Decimal fraction of fixed bitness. */
export type Decimal<N extends Num, B extends number> = { __denom: N } & Uint<B>; 
export type Decimal64<P extends Num>  = Decimal<P, 64>;  // deprecated
export type Decimal128<P extends Num> = Decimal<P, 128>; // deprecated
export type Decimal256<P extends Num> = Decimal<P, 256>; // deprecated

export type Base<B extends Number> = {
  __base: N,
  encode: (_: Num) => Bytes,
  decode: (_: Bytes) => Num,
}

/** String, or something with a `toString` method. */
export type Stringy = string|{ toString(): string };

/** Names of known hash types. */
export type HashAlgo = 'sha256';

/** Hash. */
export type Hash<A extends HashAlgo> = string|Uint8Array & { __hash: A };

/** Hashed item. */
export type Hashed<A extends HashAlgo> = { /** The hash. */ hash: Hash<A> };

/** Output target, e.g. `process.stdout`. */
export type Write = { write (...data: unknown[]): unknown };

export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);

/** TODO: Alias for various buffer types. */
export type Bytes = Uint8Array;

/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];

/** Show a stringified object. */
export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};
