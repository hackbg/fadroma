import { CommandContext } from '@hackbg/komandi'
import { ClientError } from './core-events'
import { Metadata } from './core-fields'
import type { Overridable } from './core-fields'
import type { CodeHash } from './core-code'

export function intoSource (x: Partial<ContractSource>): ContractSource {
  if (x instanceof ContractSource) return x
  return new ContractSource(x)
}

/** Contract lifecycle object. Represents a smart contract's lifecycle from source to binary. */
export class ContractSource extends Metadata {
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string     = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean    = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string     = undefined
  /** Name of crate in workspace. */
  crate?:      string     = undefined
  /** List of crate features to enable during build. */
  features?:   string[]   = undefined
  /** Build procedure implementation. */
  builder?:    Builder    = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string     = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash   = undefined

  constructor (options: Partial<ContractSource> = {}) {
    super(options)
    this.define(options as object)
  }

  get compiled (): Promise<ContractSource> {
    if (this.artifact) return Promise.resolve(this)
    return this.build()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Promise<ContractSource> {
    return this.task(`compile ${this.crate ?? 'contract'}`, async () => {
      builder ??= assertBuilder(this)
      const result = await builder!.build(this as Buildable)
      this.define(result as Partial<this>)
      return this
    })
  }

  /** @returns the data for saving a build receipt. */
  get asBuildReceipt (): Partial<this> {
    return {
      repository: this.repository,
      revision:   this.revision,
      dirty:      this.dirty,
      workspace:  this.workspace,
      crate:      this.crate,
      features:   this.features?.join(', '),
      builder:    undefined,
      builderId:  this.builder?.id,
      artifact:   this.artifact?.toString(),
      codeHash:   this.codeHash
    } as Partial<this>
  }
}

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

/** A successful build populates the `artifact` and `codeHash` fields of a `ContractSource`. */
export interface Built {
  artifact: NonNullable<ContractSource["artifact"]>
  codeHash: NonNullable<ContractSource["codeHash"]>
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
