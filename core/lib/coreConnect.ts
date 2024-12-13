import type * as Fadroma from './coreTypes.ts'

export function makeChain ({ chain, methods }: {
  chain:   Partial<Fadroma.Chain> & {
    getConnection (): Fadroma.Connection
    connections?:     Fadroma.Connection[]
  },
  methods: Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(chain, {
      [name]: (...args: unknown[]) => {
        const connection = chain.getConnection()
        const method = connection[name] as typeof method
        connection[name](connection, ...args)
      }
    })
  }
  return chain
}

export function makeConnection ({ connection, methods }: {
  connection: Partial<Fadroma.Chain>,
  methods:    Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(connection, {
      [name]: (...args: unknown[]) => method(connection, ...args)
    })
  }
  return connection
}
