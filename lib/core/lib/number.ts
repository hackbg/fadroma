import { Format } from '../deps.ts'

export const base16 = Format.base16

export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)]

export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}
