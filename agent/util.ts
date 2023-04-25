export { default as Error } from './AgentError'
export * from './AgentError'

export { default as Console } from './AgentConsole'
export * from './AgentConsole'

export { timestamp } from '@hackbg/logs'

export * from '@hackbg/into'
export * from '@hackbg/over'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'

/** A class constructor. */
export interface Class<T, U extends unknown[]> {
  new (...args: U): T
}
