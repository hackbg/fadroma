import { Console, Logged, assign, bold, base16, SHA256 } from './core'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

export abstract class Compiler extends Logged {
  /** Whether to enable build caching.
    * When set to false, this compiler will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this compiler implementation. */
  abstract id: string

  /** Compile a source.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants using its `build.impl.mjs` script. */
  abstract build (source: string|Partial<SourceCode>, ...args: unknown[]):
    Promise<CompiledCode>

  /** Build multiple sources.
    * Default implementation of buildMany is sequential.
    * Compiler classes may override this to optimize. */
  async buildMany (inputs: Partial<SourceCode>[]): Promise<CompiledCode[]> {
    const templates: CompiledCode[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }
}

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

  get canFetch (): boolean {
    return !!this.sourceOrigin
  }

  get canFetchInfo (): string|undefined {
    if (!this.sourceOrigin) return "missing sourceOrigin"
  }

  get canCompile (): boolean {
    return !!this.sourcePath || this.canFetch
  }

  get canCompileInfo (): string|undefined {
    if (!this.sourcePath) return "missing sourcePath"
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

  get [Symbol.toStringTag] () {
    return [
      this.cargoWorkspace
        ? ((this.cargoCrate ? `crate ${this.cargoCrate} from` : 'unknown crate from')
           +this.cargoWorkspace)
        : this.cargoToml,
      super[Symbol.toStringTag],
    ].filter(Boolean).join(' ')
  }

  serialize (): ReturnType<SourceCode["serialize"]> & {
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

  get canCompile (): boolean {
    const hasWorkspace = !!this.cargoWorkspace
    const hasCrateToml = !!this.cargoToml
    const hasCrateName = !!this.cargoCrate
    return (
      ( hasWorkspace && !hasCrateToml &&  hasCrateName) ||
      (!hasWorkspace &&  hasCrateToml && !hasCrateName)
    )
  }

  get canCompileInfo (): string|undefined {
    let result = super.canCompileInfo
    let error
    const hasWorkspace = !!this.cargoWorkspace
    const hasCrateToml = !!this.cargoToml
    const hasCrateName = !!this.cargoCrate
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
    if (result || error) {
      return [result, error].filter(Boolean).join('; ')
    }
  }
}

/** An object representing a given compiled binary. */
export class CompiledCode {
  /** Code hash uniquely identifying the compiled code. */
  codeHash?: CodeHash
  /** Location of the compiled code. */
  codePath?: string|URL
  /** The compiled code. */
  codeData?: Uint8Array

  constructor (properties: Partial<CompiledCode> = {}) {
    assign(this, properties, [ 'codeHash', 'codePath', 'codeData' ])
  }

  get [Symbol.toStringTag] () {
    return [
      this.codePath && `${this.codePath}`,
      this.codeHash && `${this.codeHash}`,
      this.codeData && `(${this.codeData.length} bytes)`
    ].filter(Boolean).join(' ')
  }

  serialize (): {
    codeHash?: CodeHash
    codePath?: string
    [key: string]: unknown
  } {
    const { codeHash, codePath } = this
    return { codeHash, codePath: codePath?.toString() }
  }

  get canFetch (): boolean {
    return !!this.codePath
  }

  get canFetchInfo (): string|undefined {
    if (!this.codePath) {
      return "can't fetch binary: codePath is not set"
    }
  }

  get canUpload (): boolean {
    return !!this.codeData || this.canFetch
  }

  get canUploadInfo (): string|undefined {
    if (!this.codeData && this.canFetch) {
      return "uploading will fetch the binary from the specified path"
    }
    if (this.codeData && !this.codePath) {
      return "uploading from buffer, codePath is unspecified"
    }
  }

  async fetch (): Promise<Uint8Array> {
    const console = new Console(`CompiledCode(${bold(this[Symbol.toStringTag])})`)
    if (this.codeData) {
      console.debug("not fetching: codeData found; unset to refetch")
      return this.codeData
    }
    if (!this.codePath) {
      throw new Error("can't fetch: missing codePath")
    }
    this.codeData = await this.doFetch()
    if (this.codeHash) {
      const hash0 = String(this.codeHash).toLowerCase()
      const hash1 = CompiledCode.toCodeHash(this.codeData)
      if (hash0 !== hash1) {
        throw new Error(`code hash mismatch: expected ${hash0}, computed ${hash1}`)
      }
    } else {
      this.codeHash = CompiledCode.toCodeHash(this.codeData)
      console.warn(
        "\n  TOFU: Computed code hash from fetched data:" +
        `\n  ${bold(this.codeHash)}` +
        '\n  Pin the expected code hash by setting the codeHash property.')
    }
    return this.codeData
  }

  protected async doFetch () {
    if (!this.codePath) {
      throw new Error("can't fetch: codePath not set")
    }
    const request = await fetch(this.codePath!)
    const response = await request.arrayBuffer()
    return new Uint8Array(response)
  }

  /** Compute the code hash if missing; throw if different. */
  async computeHash (): Promise<this & { codeHash: CodeHash }> {
    const hash = CompiledCode.toCodeHash(await this.fetch())
    if (this.codeHash) {
      if (this.codeHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error(`computed code hash ${hash} did not match preexisting ${this.codeHash}`)
      }
    } else {
      this.codeHash = hash
    }
    return this as this & { codeHash: CodeHash }
  }

  static toCodeHash (data: Uint8Array): string {
    return base16.encode(SHA256(data)).toLowerCase()
  }
}
