/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, bold, assign, base16, sha256 } from './base'
import type { Class, Address, TxHash } from './base'
import type { ChainId, Agent } from './chain'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

const console = new Console()

export abstract class Compiler {
  log = new Console(this.constructor.name)

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

export class ContractCode {
  source?:   SourceCode
  compiler?: Compiler
  compiled?: CompiledCode
  uploader?: Agent|Address
  uploaded?: UploadedCode
  deployer?: Agent|Address

  constructor (properties?: Partial<ContractCode>) {
    assign(this, properties, [
      'source', 'compiler', 'compiled', 'uploader', 'uploaded', 'deployer'
    ])
  }

  /** Compile this contract, unless a valid binary is present and a rebuild is not requested. */
  async compile ({
    compiler = this.compiler,
    rebuild = false,
    ...buildOptions
  }: {
    compiler?: Compiler
    rebuild?: boolean
  } = {}): Promise<CompiledCode & Parameters<Compiler["build"]>[1] & {
    codeHash: CodeHash
  }> {
    if (this.compiled?.canUpload && !rebuild) {
      return this.compiled as typeof this["compiled"] & { codeHash: CodeHash }
    }
    if (!compiler) {
      throw new Error("can't compile: no compiler")
    }
    if (!this.source) {
      throw new Error(`can't compile: no source`)
    }
    if (!this.source.canCompile) {
      throw new Error(`can't compile: ${this.source.canCompileInfo??'unspecified reason'}`)
    }
    const compiled = await compiler.build(this.source, buildOptions)
    if (!compiled.canUpload) {
      throw new Error("build failed")
    }
    return this.compiled = compiled
  }

  /** Upload this contract, unless a valid upload is present and a rebuild is not requested. */
  async upload ({
    compiler  = this.compiler,
    rebuild  = false,
    uploader = this.uploader,
    reupload = rebuild,
    ...uploadOptions
  }: Parameters<this["compile"]>[0] & Parameters<Agent["upload"]>[1] & {
    uploader?: Address|{ upload: Agent["upload"] }
    reupload?: boolean,
  } = {}): Promise<UploadedCode & {
    codeId: CodeId
  }> {
    if (this.uploaded?.canInstantiate && !reupload && !rebuild) {
      return this.uploaded
    }
    if (!uploader || (typeof uploader === 'string')) {
      throw new Error("can't upload: no uploader agent")
    }
    const compiled = await this.compile({ compiler, rebuild })
    const uploaded = await uploader.upload(compiled, uploadOptions)
    if (!uploaded.canInstantiate) {
      throw new Error("upload failed")
    }
    return this.uploaded = uploaded
  }
}

/** An object representing a given source code. */
export class SourceCode {
  /** URL pointing to Git upstream containing the canonical source code. */
  sourceOrigin?: string|URL
  /** Pointer to the source commit. */
  sourceRef?:    string
  /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
  sourcePath?:   string
  /** Whether the code contains uncommitted changes. */
  sourceDirty?:  boolean

  constructor (properties: Partial<SourceCode> = {}) {
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
        ? (this.cargoCrate ? `crate ${this.cargoCrate} from` : 'unknown crate from')
        : undefined,
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
    return super.canCompile && (
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
  codeHash?:  CodeHash
  /** Location of the compiled code. */
  codePath?:  string|URL
  /** The compiled code. */
  codeData?:  Uint8Array

  constructor (properties: Partial<CompiledCode> = {}) {
    assign(this, properties, [
      'codeHash', 'codePath', 'codeData'
    ])
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
    if (this.codeData) {
      console.debug("not fetching: codeData found; unset to refetch")
      return this.codeData
    }
    if (!this.codePath) {
      throw new Error("can't fetch: missing codePath")
    }
    if (typeof this.codePath === 'string') {
      this.codeData = await this.fetchFromPath(this.codePath)
    } else if (this.codePath instanceof URL) {
      this.codeData = await this.fetchFromURL(this.codePath)
    } else {
      throw new Error("can't fetch: invalid codePath")
    }
    if (this.codeHash) {
      const hash0 = String(this.codeHash).toLowerCase()
      const hash1 = base16.encode(sha256(this.codeData)).toLowerCase()
      if (hash0 !== hash1) {
        throw new Error(`code hash mismatch: expected ${hash0}, computed ${hash1}`)
      }
    } else {
      this.codeHash = base16.encode(sha256(this.codeData)).toLowerCase() 
      console.warn("Computed code hash from fetched data:", bold(this.codeHash))
    }
    return this.codeData
  }

  protected async fetchFromPath (path: string) {
    const { readFile } = await import('node:fs/promises')
    return await readFile(path)
  }

  protected async fetchFromURL (url: URL) {
    if (url.protocol === 'file:') {
      const { fileURLToPath } = await import('node:url')
      return await this.fetchFromPath(fileURLToPath(url))
    } else {
      const request = await fetch(url)
      const response = await request.arrayBuffer()
      return new Uint8Array(response)
    }
  }

  /** Compute the code hash if missing; throw if different. */
  async computeHash (): Promise<CodeHash> {
    const hash = base16.encode(sha256(await this.fetch()))
    if (this.codeHash) {
      if (this.codeHash.toLowerCase() !== hash.toLowerCase()) {
        throw new Error(`computed code hash ${hash} did not match preexisting ${this.codeHash}`)
      }
    } else {
      this.codeHash = hash
    }
    return hash
  }

  static toBase16Sha256 (data: Uint8Array): string {
    return base16.encode(sha256(data))
  }
}

/** An object representing the contract's binary uploaded to a given chain. */
export class UploadedCode {
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash
  /** address of agent that performed the upload. */
  uploadBy?:   Address|Agent
  /** address of agent that performed the upload. */
  uploadGas?:  string|number

  constructor (properties: Partial<UploadedCode> = {}) {
    assign(this, properties, [
      'codeHash', 'chainId', 'codeId', 'uploadTx', 'uploadBy', 'uploadGas',
    ])
  }

  serialize (): {
    codeHash?:     CodeHash
    chainId?:      ChainId
    codeId?:       CodeId
    uploadTx?:     TxHash
    uploadBy?:     Address
    uploadGas?:    string|number
    uploadInfo?:   string
    [key: string]: unknown
  } {
    let { codeHash, chainId, codeId, uploadTx, uploadBy, uploadGas } = this
    if ((typeof this.uploadBy === 'object')) {
      uploadBy = (uploadBy as Agent).address
    }
    return { codeHash, chainId, codeId, uploadTx, uploadBy: uploadBy as string, uploadGas }
  }

  get canInstantiate (): boolean {
    return !!(this.chainId && this.codeId)
  }

  get canInstantiateInfo (): string|undefined {
    return (
      (!this.chainId) ? "can't instantiate: no chain id" :
      (!this.codeId)  ? "can't instantiate: no code id"  :
      undefined
    )
  }
}
