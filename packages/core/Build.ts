import Error   from './Error'
import Console from './Console'

import { CommandContext } from '@hackbg/cmds'
import { defineTask, pluralize } from './Fields'
import type { Deployment } from './Deployment'
import type { Class } from './Fields'
import type { CodeHash } from './Code'
import type { Buildable, Built } from './Contract'
import type { Task } from '@hackbg/task'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

export function build <B extends Buildable> (
  buildable: B,
  builder:   Builder|undefined = buildable.builder
): Task<B, Built> {
  return defineTask(`compile ${buildable.crate ?? 'contract'}`, doBuild, buildable)
  async function doBuild (this: B) {
    builder ??= assertBuilder(this)
    const result = await builder!.build(this as Buildable)
    return result
  }
}

export async function buildMany (
  contracts: Buildable[],
  context:   Partial<Deployment>,
): Promise<Built[]> {
  return defineTask(`build ${contracts.length} contracts`, async () => {
    if (!context.builder) throw new Error.NoBuilder()
    if (contracts.length === 0) return Promise.resolve([])
    const count = pluralize(contracts, `contract:`, `contracts:`)
    const sources = contracts.map(contract=>`${contract.crate}@${contract.revision}`).join(', ')
    const name = `build ${count} ${sources}`
    return defineTask(name, async function buildManyContracts () {
      if (!context.builder) throw new Error.NoBuilder()
      const result = await context.builder.buildMany(contracts)
      return result
    }, context)
  }, context)
}

/** Builders can be specified as ids, class names, or objects. */
/** A constructor for a Builder subclass. */
export type BuilderClass<B extends Builder> = Class<Builder, any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder extends CommandContext {
  /** Populated by @fadroma/build */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/build` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (source: Buildable, ...args: any[]): Promise<Built>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: Buildable[], ...args: unknown[]): Promise<Built[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

/** Throw appropriate error if not buildable. */
export function assertBuilder ({ builder }: { builder?: Builder }): Builder {
  //if (!this.crate) throw new ClientError.NoCrate()
  if (!builder) throw new Error.NoBuilder()
  //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
  return builder
}
