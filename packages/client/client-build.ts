import { CommandContext } from '@hackbg/komandi'
import { ClientError } from './client-events'
import type { Overridable } from './client-fields'
import type { ContractSource } from './client-contract'

/** For a contract to be buildable, the location of its source must be specified.
  * For now this means that the `crate` field should be set; however there are multiple
  * thinkable ways of specifying a contract, which this interface should eventually cover:
  * - local single-crate project
  * - crate from local workspace
  * - remote single-crate project
  * - crate from remote workspace */
export interface Buildable {
  crate:      NonNullable<ContractSource["crate"]>
  workspace?: ContractSource["workspace"]
  revision?:  ContractSource["revision"]
}

/** A successful build populates the `artifact` field of a `ContractSource`. */
export interface Built extends ContractSource {
  artifact: NonNullable<ContractSource["artifact"]>
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

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** Throw appropriate error if not buildable. */
export function assertBuilder ({ builder }: { builder?: Builder }): Builder {
  //if (!this.crate) throw new ClientError.NoCrate()
  if (!builder) throw new ClientError.NoBuilder()
  //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
  return builder
}
