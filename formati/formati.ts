import { URL } from 'url'
import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { bech32, bech32m } from 'bech32'

export const randomHex = (bytes = 1) =>
  randomBytes(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  randomBytes(bytes).toString("base64")

/** By default this generates 32 bytes - default length of canonical addr in Cosmos */
export const randomBech32 = (prefix = 'hackbg', bytes = 32) =>
  bech32.encode(prefix, bech32.toWords(randomBytes(bytes)))

export const randomBech32m = (prefix = 'hackbg', bytes = 32) =>
  bech32m.encode(prefix, bech32m.toWords(randomBytes(bytes)))

export const loadJSON = (path = '', base = null) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))

export function pick (
  obj = {},
  ...keys
) {
  return Object.keys(obj)
    .filter(key=>keys.indexOf(key)>-1)
    .reduce((obj2,key)=>{
      obj2[key] = obj[key]
      return obj2 }, {})
}

export function required (label) {
  return () => { throw new Error(`required: ${label}`) }
}

export * from '@iov/crypto'
export * from '@iov/encoding'

export {
  bech32,
  bech32m,
  randomBytes
}

