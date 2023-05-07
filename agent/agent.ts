export * from './agent-base'
export * from './agent-chain'
export * from './agent-token'
export * from './agent-client'
export * from './agent-deploy'
export * from './agent-services'
export * as Mocknet from './agent-mocknet'

// This is here to prevent a circular dependency:
import { Chain } from './agent-chain'
import * as Mocknet from './agent-mocknet'
Chain.mocknet = (options: Partial<Mocknet.Chain> = {}): Mocknet.Chain => new Mocknet.Chain({
  id: 'mocknet',
  ...options
})
