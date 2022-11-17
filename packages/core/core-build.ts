import { CommandContext } from '@hackbg/komandi'
import { ClientError } from './core-events'
import { defineTask, pluralize } from './core-fields'
import { ClientError as Error } from './core-events'
import type { Deployment } from './core-deployment'
import type { Overridable } from './core-fields'
import type { CodeHash } from './core-code'
import type { Buildable, Built } from './core-contract'
import type { Task } from '@hackbg/komandi'

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
export type BuilderClass<B extends Builder> = Overridable<Builder, [
  string|BuilderClass<Builder>|Partial<Builder>
]>

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
  if (!builder) throw new ClientError.NoBuilder()
  //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
  return builder
}
