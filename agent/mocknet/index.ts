export * from './MocknetChain'
export * as Backend from './MocknetBackend'
export { default as Console } from './MocknetConsole'
export { default as Error } from './MocknetError'

import * as Mocknet from './MocknetChain'
import { MocknetBackend_CW0, MocknetBackend_CW1 } from './MocknetBackend'
class Mocknet_CW0 extends Mocknet.Chain { backend = new MocknetBackend_CW0(this.id) }
class Mocknet_CW1 extends Mocknet.Chain { backend = new MocknetBackend_CW1(this.id) }
export { Mocknet_CW0 as CW0, Mocknet_CW1 as CW1 }
