import { testChainSupport } from './tester'
import * as Stub from './stub'
import { fixture } from '@fadroma/fixtures'
export default async function testStubImpl () {
  await testChainSupport(
    Stub.Connection,
    Stub.Backend,
    '',
    '',
    fixture('scrt-null.wasm')
  )
}
