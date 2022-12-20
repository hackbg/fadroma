import { Metadata }      from './core-fields'
import { assertBuilder } from './core-build'
import type { Builder }  from './core-build'

export function intoSource (x: Partial<ContractSource>): ContractSource {
  if (x instanceof ContractSource) return x
  return new ContractSource(x)
}

/** Create a callable object based on ContractSource.
  * Pass it around to represent the source of a contract,
  * and call it to compile. */
export function defineSource (
  options: Partial<ContractSource> = {}
): ContractSource & (() => Promise<ContractSource>) {

  const source = new ContractSource(options)

  const rebind = (obj, [k, v])=>Object.assign(obj, {
    [k]: (typeof v === 'function') ? v.bind(getOrCompileArtifact) : v
  }, {})

  return Object.assign(
    getOrCompileArtifact.bind(getOrCompileArtifact),
    Object.entries(source).reduce(rebind)
  )

  function getOrCompileArtifact () {
    return this.compiled
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
}
