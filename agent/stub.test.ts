import * as Stub from './stub'
import { Identity } from './chain'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  await testConnectionWithBackend(
    Stub.StubConnection,
    Identity,
    Stub.StubBackend,
    '',
    '',
    fixture('scrt-null.wasm')
  )
}
