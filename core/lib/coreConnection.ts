import type { Entity } from './coreEntity.ts'
import type { Chain } from './coreChain.ts'

/** Represents an individual remote API endpoint. */
export interface Connection extends Entity {
  chain: Chain
  url:   string|URL
  alive: boolean
}

export function makeConnection ({ connection, methods }: {
  connection: Partial<Connection>,
  methods:    Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(connection, {
      [name]: (...args: unknown[]) => method(connection, ...args)
    })
  }
  return connection
}
