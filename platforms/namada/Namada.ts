import Console from './NamadaConsole'
import Chain from './NamadaChain'
import Connection from './NamadaConnection'
import Block, { Transaction } from './NamadaBlock'
import { Decode, initDecoder } from './NamadaDecode'
import * as Identity from './NamadaIdentity'
export {
  Decode,
  initDecoder,
  Console,
  Chain,
  Connection,
  Block,
  Transaction,
  Identity
}
export const testnetChainId = Chain.testnetChainId
export const testnetURLs    = Chain.testnetURLs
export function connect (...args: Parameters<typeof Chain.connect>) {
  return Chain.connect(...args)
}
export function testnet (...args: Parameters<typeof Chain.testnet>) {
  return Chain.testnet(...args)
}
export function mainnet (...args: never) {
  throw new Error(
    'Connection details for Namada mainnet are not built into Fadroma yet. ' +
    'You can pass them to Namada.connect function if you have them.'
  )
}
export type { Validator } from './NamadaPoS'
