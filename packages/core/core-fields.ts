import { ClientConsole as Console, ClientError as Error } from './core-events'
import { Task } from '@hackbg/task'

export function defineTask <T, U> (
  name:     string,
  cb:       (this: T)=>U|PromiseLike<U>,
  context?: T & { log?: Console }
): Task<T, U> {
  const task = new Task(name, cb, context as unknown as T)
  const [_, head, ...body] = (task.stack ?? '').split('\n')
  task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
  task.log   = (context?.log ?? task.log) as any
  return task as Task<T, U>
}

/** A class constructor. */
export interface Class<T, U extends unknown[]> {
  new (...args: U): T
}

export type Maybe<T> = T|undefined

export function getMaxLength (strings: string[]): number {
  return Math.max(...strings.map(string=>string.length))
}

/** A class constructor for an extensible value object. */
export interface Overridable<T, U> extends Class<T, [Partial<T>?]|[U|Partial<T>, Partial<T>?]> {
}

export * from '@hackbg/into'
export * from '@hackbg/over'
export * from '@hackbg/hide'
export * from '@hackbg/many'
