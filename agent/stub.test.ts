import * as Stub from './stub'
import { Identity } from './chain'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  await testConnectionWithBackend(
    Stub.StubConnection,
    Identity,
    Stub.StubBackend,
    'stub',
    '0.0',
    'ustub',
    fixture('scrt-null.wasm')
  )
}
