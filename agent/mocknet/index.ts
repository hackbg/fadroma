import Mocknet from './MocknetChain'
export { default as Mocknet } from './MocknetChain'
export * from './MocknetChain'

import MocknetAgent from './MocknetAgent'
export { default as MocknetAgent } from './MocknetAgent'
export * from './MocknetAgent'

import MocknetBundle from './MocknetBundle'
export { default as MocknetBundle } from './MocknetBundle'
export * from './MocknetBundle'

export { default as MocknetContract } from './MocknetContract'

export { default as MocknetBackend } from './MocknetBackend'

export * from './MocknetData'

import { MocknetBackend_CW0, MocknetContract_CW0 } from './Mocknet_CW0'
import { MocknetBackend_CW1, MocknetContract_CW1 } from './Mocknet_CW1'

Object.assign(Mocknet, { Agent: Object.assign(MocknetAgent, { Bundle: MocknetBundle }) })
Object.assign(MocknetBackend_CW0, { Contract: MocknetContract_CW0 })
Object.assign(MocknetBackend_CW1, { Contract: MocknetContract_CW1 })

export { default as Mocknet_CW0 } from './Mocknet_CW0'
export { default as Mocknet_CW1 } from './Mocknet_CW1'

export { ADDRESS_PREFIX as MOCKNET_ADDRESS_PREFIX } from './MocknetData'

export default Mocknet
