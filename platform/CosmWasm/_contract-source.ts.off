import { Logged, assign } from '../Util.ts'

/** An object representing a given source code. */
export class SourceCode extends Logged {
  /** URL pointing to Git upstream containing the canonical source code. */
  sourceOrigin?: string|URL
  /** Pointer to the source commit. */
  sourceRef?:    string
  /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
  sourcePath?:   string
  /** Whether the code contains uncommitted changes. */
  sourceDirty?:  boolean

  constructor (properties: Partial<SourceCode> = {}) {
    super(properties)
    assign(this, properties, [
      'sourcePath', 'sourceOrigin', 'sourceRef', 'sourceDirty'
    ])
  }

  get [Symbol.toStringTag] () {
    return [
      this.sourcePath ? this.sourcePath : `(missing source)`,
      this.sourceOrigin && `(from ${this.sourceOrigin})`,
      this.sourceRef    && `(at ${this.sourceRef})`,
      this.sourceDirty  && `(modified)`
    ].filter(Boolean).join(' ')
  }

  serialize (): {
    sourceOrigin?: string
    sourceRef?:    string
    sourcePath?:   string
    sourceDirty?:  boolean
    [key: string]: unknown
  } {
    const { sourcePath, sourceOrigin, sourceRef, sourceDirty } = this
    return { sourcePath, sourceOrigin: sourceOrigin?.toString(), sourceRef, sourceDirty }
  }

  status () {
    const canFetch       = !!this.sourceOrigin
    const canFetchInfo   = (!this.sourceOrigin) ? "missing sourceOrigin" : undefined
    const canCompile     = !!this.sourcePath || canFetch
    const canCompileInfo = (!this.sourcePath) ? "missing sourcePath" : undefined
    return { canFetch, canFetchInfo, canCompile, canCompileInfo }
  }
}

export class RustSourceCode extends SourceCode {
  /** Path to the crate's Cargo.toml under sourcePath */
  cargoToml?:      string
  /** Path to the workspace's Cargo.toml in the source tree. */
  cargoWorkspace?: string
  /** Name of crate. */
  cargoCrate?:     string
  /** List of crate features to enable during build. */
  cargoFeatures?:  string[]|Set<string>

  constructor (properties?: Partial<RustSourceCode>) {
    super(properties)
    assign(this, properties, [
      'cargoToml', 'cargoWorkspace', 'cargoCrate', 'cargoFeatures'
    ])
  }

  override get [Symbol.toStringTag] () {
    return [
      this.cargoWorkspace
        ? ((this.cargoCrate ? `crate ${this.cargoCrate} from` : 'unknown crate from')
           +this.cargoWorkspace)
        : this.cargoToml,
      super[Symbol.toStringTag],
    ].filter(Boolean).join(' ')
  }

  override serialize (): ReturnType<SourceCode["serialize"]> & {
    cargoWorkspace?: string
    cargoCrate?:     string
    cargoFeatures?:  string[]
    [key: string]:   unknown
  } {
    const {
      cargoToml,
      cargoWorkspace,
      cargoCrate,
      cargoFeatures
    } = this
    return {
      ...super.serialize(),
      cargoToml,
      cargoWorkspace,
      cargoCrate,
      cargoFeatures: cargoFeatures ? [...cargoFeatures] : undefined
    }
  }

  status () {
    const status = super.status()

    const { canFetch, canFetchInfo } = status
    const hasWorkspace = !!this.cargoWorkspace
    const hasCrateToml = !!this.cargoToml
    const hasCrateName = !!this.cargoCrate
    const canCompile = (
      ( hasWorkspace && !hasCrateToml &&  hasCrateName) ||
      (!hasWorkspace &&  hasCrateToml && !hasCrateName)
    )

    let { canCompileInfo } = status
    let error
    if (hasWorkspace) {
      if (hasCrateToml) {
        error = "cargoWorkspace is set, cargoToml must be unset"
      }
      if (!hasCrateName) {
        error = "when cargoWorkspace is set, cargoCrate must also be set"
      }
    } else if (hasCrateToml) {
      if (hasCrateName) {
        error = "when cargoToml is set, cargoCrate must be unset"
      }
    } else {
      error = "set either cargoToml or cargoWorkspace & cargoCrate"
    }
    if (canCompileInfo || error) {
      canCompileInfo = [canCompileInfo, error].filter(Boolean).join('; ')
    }

    return {
      canFetch,
      canFetchInfo,
      canCompile,
      canCompileInfo
    }
  }
}
