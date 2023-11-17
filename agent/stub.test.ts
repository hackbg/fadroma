import * as Stub from './stub'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
export default async function testStubImpl () {
  await testConnectionWithBackend(
    Stub.Connection,
    Stub.Backend,
    '',
    '',
    fixture('scrt-null.wasm')
  )
}
