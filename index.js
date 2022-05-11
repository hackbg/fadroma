export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/komandi'
export * from '@hackbg/dokeres'
export * from '@hackbg/runspec'

export * from './reexports.js'
export * from './run.js'

// misc data functions /////////////////////////////////////////////////////////////////////////////

import { randomBytes } from 'crypto'
export { randomBytes }

export const randomHex = (bytes = 1) =>
  randomBytes(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  randomBytes(bytes).toString("base64")

import { bech32, bech32m } from 'bech32'
/** By default this generates 32 bytes - default length of canonical addr in Cosmos */
export const randomBech32 = (prefix = 'hackbg', bytes = 32) =>
  bech32.encode(prefix, bech32.toWords(randomBytes(bytes)))

export const randomBech32m = (prefix = 'hackbg', bytes = 32) =>
  bech32m.encode(prefix, bech32m.toWords(randomBytes(bytes)))

import { TextDecoder } from 'util'
const decoder = new TextDecoder();
export const decode = (buffer) => decoder.decode(buffer).trim()

import { URL } from 'url'
export const loadJSON = (path = '', base = null) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))

export const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)

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
