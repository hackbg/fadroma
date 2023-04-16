export { Task } from '@hackbg/task'
export { timestamp } from '@hackbg/logs'
export { CommandContext } from '@hackbg/cmds'

export * from '@hackbg/into'
export * from '@hackbg/over'
export * from '@hackbg/hide'
export * from '@hackbg/many'

export { default as Error } from './Error'
export * from './Error'

export { default as Console } from './Console'
export * from './Console'

/** A class constructor. */
export interface Class<T, U extends unknown[]> {
  new (...args: U): T
}
