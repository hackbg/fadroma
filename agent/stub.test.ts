import * as Stub from './stub'
import { Identity } from './chain'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  const backend = new Stub.StubBackend()
  await testConnectionWithBackend(backend, {
    Connection: Stub.StubConnection,
    Identity:   Identity,
    code:       fixture('scrt-null.wasm')
  })
}
