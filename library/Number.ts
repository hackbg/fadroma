import { Bytes } from './Byte.ts';
import Fn from './Fn.ts';
import { webcrypto } from '../deps.ts';
import { base16, base64, bech32, bech32m } from 'npm:@scure/base'

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

export { base16, base64, bech32, bech32m }

export type Base<B extends number> = {
  __base: B,
  random: (bytes?: number) => string & { __base: B },
  encode: (_: Bytes)       => string & { __base: B },
  decode: (_: string)      => Bytes
};

export const Base64 = {
  __base: 64,
  random: (n = 64) => base64.encode(randomBytes(n)),
  encode: Fn.Pipe(Bytes, base64.encode),
  decode: base64.decode
} as Base<64>;

// BASE58

export const Base16 = {
  __base: 16,
  random: (n = 64)  => base16.encode(randomBytes(n)),
  encode: Fn.Pipe(Bytes, base16.encode),
  decode: base16.decode
} as Base<16>;

export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}

export const Base9 = {
  digits: "123456789",
  randomDigit: (): string =>
    Base9.digits[Math.floor(Math.random() * Base9.digits.length)],
  random: (length = 12): string =>
    Array.from({ length }).map(() =>Base9.randomDigit()).join("")
};
export const randomId = (length): number =>
  parseInt(Base9.random(length), 10);

export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)];

/** Generate Uint8Array of given length. */
export const randomBytes = (n: number = 16) =>
  (webcrypto as any).getRandomValues(new Uint8Array(n));

/** Generate random valid bech32 address.
  * Default length is 32 bytes (canonical addr in Cosmos) */
export const randomBech32  = (prefix = 'hackbg', n = 32) =>
  bech32.encode(prefix, bech32.toWords(randomBytes(n)))

/** Generate random valid bech32m address. */
export const randomBech32m = (prefix = 'hackbg', n = 32) =>
  bech32m.encode(prefix, bech32m.toWords(randomBytes(n)))
