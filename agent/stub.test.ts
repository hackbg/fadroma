import { testChainSupport } from './tester'
import * as Stub from './stub'
export default async function testStubImpl () {
  await testChainSupport(
    Stub.Connection,
    Stub.Backend,
    '',
    '',
    ''
  )
}
