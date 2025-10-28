import type { Bytes } from './bytes.ts';
import { webcrypto, base16, base64, bech32, bech32m } from '../deps.ts';

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

export type Base<B extends number> = {
  __base: B,
  encode: (_: Num) => Bytes,
  decode: (_: Bytes) => Num,
}

const numbersWithoutZero =
  "123456789";

const randomNumeric = (): string =>
  numbersWithoutZero[Math.floor(Math.random() * numbersWithoutZero.length)];

export const randomId = (length = 12): number =>
  parseInt(Array.from({ length }) .map(() => randomNumeric()).join(""), 10);

export const addZeros = (n: number|Uint128, z: number) =>
  `${n}${[...Array(z)].map(() => '0').join('')}` as Uint128;

export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}
export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)];

/** Returns Uint8Array of given length. */
export const randomBytes = (n: number = 16) =>
  webcrypto.getRandomValues(new Uint8Array(n))

/** Returns a hex-encoded string of given length.
  * Default is 16 bytes, i.e. 128 bits of entropy. */
export const randomBase16 = (n: number = 16) =>
  base16.encode(randomBytes(n))

/** Returns a base64-encoded string of given length.
  * Default is 64 bytes, i.e. 512 bits of entropy. */
export const randomBase64  = (n: number = 64) =>
  base64.encode(randomBytes(n))

/** Returns a random valid bech32 address.
  * Default length is 32 bytes (canonical addr in Cosmos) */
export const randomBech32  = (prefix = 'hackbg', n = 32) =>
  bech32.encode(prefix, bech32.toWords(randomBytes(n)))

/** Returns a random valid bech32m address. */
export const randomBech32m = (prefix = 'hackbg', n = 32) =>
  bech32m.encode(prefix, bech32m.toWords(randomBytes(n)))
