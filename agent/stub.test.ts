import * as Stub from './stub'
import { Identity } from './chain'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  await testConnectionWithBackend({
    Connection:      Stub.StubConnection,
    Identity:        Identity,
    Backend:         Stub.StubBackend,
    platformName:    'stub',
    platformVersion: '0.0',
    gasToken:        'ustub',
    code:            fixture('scrt-null.wasm')
  })
}
