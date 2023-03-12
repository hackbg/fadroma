import Mocknet from './MocknetChain'
import MocknetAgent from './MocknetAgent'
import MocknetBundle from './MocknetBundle'
Object.assign(Mocknet, { Agent: Object.assign(MocknetAgent, {   Bundle: MocknetBundle }) })
import { MocknetBackend_CW0, MocknetContract_CW0 } from './Mocknet_CW0'
Object.assign(MocknetBackend_CW0, { Contract: MocknetContract_CW0 })
import { MocknetBackend_CW1, MocknetContract_CW1 } from './Mocknet_CW1'
Object.assign(MocknetBackend_CW1, { Contract: MocknetContract_CW1 })

export { default as Chain } from './MocknetChain'
export { default as CW0 } from './Mocknet_CW0'
export { default as CW1 } from './Mocknet_CW1'
export * from './MocknetChain'
export { default as Agent } from './MocknetAgent'
export * from './MocknetAgent'
export { default as Bundle } from './MocknetBundle'
export * from './MocknetBundle'
export { default as Contract } from './MocknetContract'

export { ADDRESS_PREFIX } from './MocknetData'
