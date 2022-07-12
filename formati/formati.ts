import { bech32, bech32m } from 'bech32'

import secureRandom from 'secure-random'

export { bech32, bech32m }

export { toBase64, fromBase64, fromUtf8, fromHex, toHex } from '@iov/encoding'

export { Sha256 } from '@iov/crypto'

export const randomBytes = secureRandom.randomBuffer

export const randomHex = (bytes = 1) =>
  secureRandom.randomBuffer(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  secureRandom.randomBuffer(bytes).toString("base64")

/** By default this generates 32 bytes - default length of canonical addr in Cosmos */
export const randomBech32 = (prefix = 'hackbg', bytes = 32) =>
  bech32.encode(prefix, bech32.toWords(secureRandom.randomBuffer(bytes)))

export const randomBech32m = (prefix = 'hackbg', bytes = 32) =>
  bech32m.encode(prefix, bech32m.toWords(secureRandom.randomBuffer(bytes)))

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
