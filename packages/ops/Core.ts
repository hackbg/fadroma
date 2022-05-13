import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { Console, bold, colors } from '@hackbg/konzola'
import { Sha256 } from '@iov/crypto'

import { config } from './Config'

const console = Console('Fadroma Ops')

export type Label = string

export type InitMsg = string|Record<string, any>

export const join = (...x:any[]) => x.map(String).join(' ')

export const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}

export { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
export type { Coin, Fees } from '@fadroma/client'
export { Fee } from '@fadroma/client'
