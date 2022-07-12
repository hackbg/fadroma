import { URL } from 'url'
import { readFileSync } from 'fs'
import { bech32, bech32m } from 'bech32'
import { randomBuffer } from 'secure-random'

export const randomHex = (bytes = 1) =>
  randomBuffer(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  randomBuffer(bytes).toString("base64")

/** By default this generates 32 bytes - default length of canonical addr in Cosmos */
export const randomBech32 = (prefix = 'hackbg', bytes = 32) =>
  bech32.encode(prefix, bech32.toWords(randomBuffer(bytes)))

export const randomBech32m = (prefix = 'hackbg', bytes = 32) =>
  bech32m.encode(prefix, bech32m.toWords(randomBuffer(bytes)))

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

export { bech32, bech32m, randomBuffer as randomBytes }
export { toBase64, fromBase64, fromUtf8, fromHex, toHex } from '@iov/encoding'
export { Sha256 } from '@iov/crypto'
