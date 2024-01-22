import assert from 'node:assert'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
import { ScrtMnemonicIdentity } from './scrt'
import * as Mocknet from './scrt-mocknet'

export default async function testScrtMocknet () {

  {
    const backend  = new Mocknet.Backend()
    const agent    = new Mocknet.Connection({ backend })
    const contract = new Mocknet.Contract(backend)
  }

  const { backend, alice, bob, guest } = await testConnectionWithBackend(
    Mocknet.Connection,
    ScrtMnemonicIdentity,
    Mocknet.Backend,
    'v1.9',
    'uscrt',
    fixture('scrt-null.wasm'),
    null
  )

  // **Base64 I/O:** Fields that are of type `Binary` (query responses and the `data` field of handle
  // responses) are returned by the contract as Base64-encoded strings
  // If `to_binary` is used to produce the `Binary`, it's also JSON encoded through Serde.
  // These functions are used by the mocknet code to encode/decode the base64.
  assert.equal(Mocknet.b64toUtf8('IkVjaG8i'), '"Echo"')
  assert.equal(Mocknet.utf8toB64('"Echo"'), 'IkVjaG8i')
}
