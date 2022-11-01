import { MocknetBackend, ADDRESS_PREFIX } from './mocknet-backend'
import { MocknetContract } from './mocknet-contract'
import { Mocknet } from './mocknet-chain'
import { MocknetAgent } from './mocknet-agent'
import { MocknetBundle } from './mocknet-bundle'

Object.assign(Mocknet, {
  Agent: Object.assign(MocknetAgent, {
    Bundle: MocknetBundle
  })
})

Object.assign(MocknetBackend, {
  Contract: MocknetContract
})

export {
  ADDRESS_PREFIX,
  Mocknet,
  MocknetAgent,
  MocknetBundle,
  MocknetBackend,
  MocknetContract
}
