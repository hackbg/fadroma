import { MocknetBackend_CW0 } from './mocknet-backend'
import { MocknetContract_CW0 } from './mocknet-contract'
Object.assign(MocknetBackend_CW0, { Contract: MocknetContract_CW0 })

import { MocknetBackend_CW1 } from './mocknet-backend'
import { MocknetContract_CW1 } from './mocknet-contract'
Object.assign(MocknetBackend_CW1, { Contract: MocknetContract_CW1 })

export * from './mocknet-backend'
export * from './mocknet-contract'

import { MocknetAgent } from './mocknet-agent'
import { MocknetBundle } from './mocknet-bundle'
import { BaseMocknet } from './mocknet-chain'
Object.assign(BaseMocknet, { Agent: Object.assign(MocknetAgent, { Bundle: MocknetBundle }) })

export * from './mocknet-chain'
export * from './mocknet-agent'
export * from './mocknet-bundle'

export { ADDRESS_PREFIX } from './mocknet-data'
