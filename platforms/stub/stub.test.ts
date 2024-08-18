import * as Stub from './stub'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  const backend = new Stub.Backend()
  await testConnectionWithBackend(backend, {
    Connection: Stub.Connection,
    Identity:   Stub.Identity,
    code:       fixture('scrt-null.wasm')
  })
}
