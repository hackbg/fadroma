import { Chain } from './core-chain'
import { Agent } from './core-agent'
import { Bundle } from './core-bundle'

Object.assign(Chain, {
  Agent: Object.assign(Agent, {
    Bundle
  })
})

export * from './core-events'
export * from './core-fields'
export * from './core-math'

export * from './core-chain'
export * from './core-agent'
export * from './core-bundle'

export * from './core-tx'
export * from './core-fee'
export * from './core-code'
export * from './core-labels'

export * from './core-build'
export * from './core-upload'

export * from './core-client'
export * from './core-contract'
export * from './core-deployment'
export * from './core-deploy-store'

export { Task } from '@hackbg/task'
export { CommandContext } from '@hackbg/cmds'
export { bold, colors } from '@hackbg/logs'
