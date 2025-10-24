import { yellow } from './color.ts';

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

export const msec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(10));

export const addZeros = (n: number|Uint128, z: number): Uint128 =>
  `${n}${[...Array(z)].map(() => '0').join('')}`;
export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}
export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)];

export const dT = t0 => performance.now() - t0;
