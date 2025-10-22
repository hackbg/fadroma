/** 128-bit integer. */
export type Uint128 = number|string|bigint;
/** 256-bit integer. */
export type Uint256 = number|string|bigint;
/** 128-bit decimal fraction. */
export type Decimal128 = number|string;
/** 256-bit decimal fraction. */
export type Decimal256 = number|string;
/** Hash. */
export type Hash = string|Uint8Array;
/** Hashed item. */
export type Hashed = { /** The hash. */ hash: Hash };

const numbersWithoutZero = "123456789";
const randomNumeric = (): string => numbersWithoutZero[Math.floor(Math.random() * numbersWithoutZero.length)];
export const randomId = (length = 12): number => parseInt(Array.from({ length }) .map(() => randomNumeric()).join(""), 10);
export const formatMsec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(col1));
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
