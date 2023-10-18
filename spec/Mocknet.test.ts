import * as assert from 'node:assert'
import { Mocknet } from '@fadroma/scrt'
import { randomBech32 } from '@fadroma/agent'

import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs': () => import('./Mocknet.spec.ts.md'),
  'other': testMocknet()
})

export async function testMocknet () {
  new Mocknet.Console().log('...')
  new Mocknet.Console().trace('...')
  new Mocknet.Console().debug('...')

  // **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  // responses) are returned by the contract as Base64-encoded strings
  // If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  // These functions are used by the mocknet code to encode/decode the base64.
  assert.equal(Mocknet.b64toUtf8('IkVjaG8i'), '"Echo"')
  assert.equal(Mocknet.utf8toB64('"Echo"'), 'IkVjaG8i')

  let key:   string
  let value: string
  let data:  string
}

export function mockEnv () {
  const height   = 0
  const time     = 0
  const chain_id = "mock"
  const sender   = randomBech32('mocked')
  const address  = randomBech32('mocked')
  return {
    block:    { height, time, chain_id },
    message:  { sender: sender, sent_funds: [] },
    contract: { address },
    contract_key: "",
    contract_code_hash: ""
  }
}
