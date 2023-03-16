import { Chain } from './Chain'
import { Agent } from './Agent'
import { Bundle } from './Bundle'

Object.assign(Chain, {
  Agent: Object.assign(Agent, {
    Bundle
  })
})

export { default as ClientError } from './Error'
export { default as ClientConsole } from './Console'
export * from './Fields'
export * from './Math'

export * from './Chain'
export * from './Agent'
export * from './Bundle'

export * from './Tx'
export * from './Fee'
export * from './Code'
export * from './Labels'

export * from './Build'
export * from './Upload'

export * from './Client'
export * from './Deployment'
export * from './DeployStore'

export { default as Template } from './Template'
export * from './Template'

export * from './Contract'

export { Task } from '@hackbg/task'
export { CommandContext } from '@hackbg/cmds'
export { bold, colors } from '@hackbg/logs'
export * from '@hackbg/into'
