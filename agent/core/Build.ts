import type {
  Deployment, Class, CodeHash
} from '../index'
import { Error, Console, pluralize } from '../util'

/** Parameters involved in building a contract. */
export interface Buildable {
  crate:       string
  features?:   string[]
  workspace?:  string
  repository?: string|URL
  revision?:   string
  dirty?:      boolean
  builder?:    Builder
}

/** Result of building a contract. */
export interface Built extends Partial<Buildable> {
  artifact:   string|URL
  codeHash?:  CodeHash
  builder?:   Builder
  builderId?: string
}

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** Builders can be specified as ids, class names, or objects. */
/** A constructor for a Builder subclass. */
export type BuilderClass<B extends Builder> = Class<Builder, any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder {
  log = new Console(this.constructor.name)

  /** Populated by @fadroma/ops */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/ops` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  async build (source: Buildable, ...args: any[]): Promise<Built> {
    this.log.warn('Builder#build: not implemented')
    return {
      artifact: 'unimplemented'
    }
  }
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: Buildable[], ...args: unknown[]): Promise<Built[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

/** Throw appropriate error if not buildable. */
export function assertBuilder ({ builder }: { builder?: Builder }): Builder {
  //if (!this.crate) throw new Error.NoCrate()
  if (!builder) throw new Error.NoBuilder()
  //if (typeof builder === 'string') throw new Error.ProvideBuilder(builder)
  return builder
}
