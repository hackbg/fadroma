import { CommandContext } from '@hackbg/komandi'
import { ClientError } from './client-events'
import type { Overridable } from './client-fields'
import type { ContractSource } from './client-contract'

/** Builders can be specified as ids, class names, or objects. */
export type IntoBuilder = string|BuilderClass<Builder>|Partial<Builder>

/** A constructor for a Builder subclass. */
export interface BuilderClass<B extends Builder> extends Overridable<Builder, IntoBuilder> {
}

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder extends CommandContext {
  /** Populated by @fadroma/build */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}): Builder {
    if (typeof specifier === 'string') {
      const B = Builder.variants[specifier]
      if (!B) throw new ClientError.NoBuilderNamed(specifier)
      return new (B as BuilderClass<Builder>)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoBuilder()
      return new (specifier as BuilderClass<Builder>)(options)
    } else {
      const B = Builder.variants[specifier?.id as string]
      return new (B as BuilderClass<Builder>)({ ...specifier, ...options })
    }
  }
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/build` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build <S extends ContractSource> (source: S, ...args: any[]): Promise<S>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: ContractSource[], ...args: unknown[]): Promise<ContractSource[]> {
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
