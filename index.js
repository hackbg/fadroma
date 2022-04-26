export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/komandi'
export * from '@hackbg/dokeres'
export * from '@hackbg/runspec'

export * from './reexports'
export * from './run'
export * from './tables'

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
import { createServer } from 'net'
export function freePort () {
  return new Promise((ok, fail)=>{
    let port = 0
    const server = createServer()
    server.on('listening', () => {
      port = server.address().port
      server.close()
    })
    server.on('close', () => ok(port))
    server.on('error', fail)
    server.listen(0, '127.0.0.1')
  })
}

// misc data functions /////////////////////////////////////////////////////////////////////////////

import { randomBytes } from 'crypto'
export { randomBytes }

export const randomHex = (bytes = 1) =>
  randomBytes(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  randomBytes(bytes).toString("base64")

/// !!! this one counts characters not bytes
/// 38 is the length of the non-fixed part in a secret1 address
export const randomBase32 = (characters = 38) => {
  const alphabet = '0123456789abcdefghjkmnpqrtuvwxyz'
  let output = ''
  for (let i = 0; i < characters; i++) {
    output += alphabet[Math.floor(Math.random()*alphabet.length)]
  }
  return output
}

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
