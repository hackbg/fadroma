import { Format } from '../deps.ts'
/** 128-bit integer. */
export type Uint128 = number|string|bigint
/** 256-bit integer. */
export type Uint256 = number|string|bigint
/** 128-bit decimal fraction. */
export type Decimal128 = number|string
/** 256-bit decimal fraction. */
export type Decimal256 = number|string

export const base16 = Format.base16

export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)]

export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}
