/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, assign, base16, sha256 } from './base'
import type { Class, Address, TxHash } from './base'
import type { ChainId, Agent } from './chain'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

assign.allow<SourceCode>('SourceCode', [
  'sourcePath', 'sourceRepo', 'sourceRef', 'sourceDirty'
])

assign.allow<RustSourceCode>('RustSourceCode', [
  'cargoWorkspace', 'cargoCrate', 'cargoFeatures'
])

assign.allow<CompiledCode>('CompiledCode', [
  'codeHash', 'codePath', 'codeData'
])

assign.allow<UploadedCode>('UploadedCode', [
  'codeHash', 'chainId', 'codeId', 'uploadTx', 'uploadBy', 'uploadGas',
])

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
    if (this.compiled?.isValid() && !rebuild) {
      return this.compiled
    }
    if (!compiler) {
      throw new Error("can't compile: no compiler")
    }
    if (!this.source?.isValid()) {
      throw new Error("can't compile: no source")
    }
    const compiled = await compiler.build(this.source, buildOptions)
    if (!compiled.isValid()) {
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
    if (this.uploaded?.isValid() && !reupload && !rebuild) {
      return this.uploaded
    }
    if (!uploader || (typeof uploader === 'string')) {
      throw new Error("can't upload: no uploader agent")
    }
    const compiled = await this.compile({ compiler, rebuild })
    const uploaded = await uploader.upload(compiled, uploadOptions)
    if (!uploaded.isValid()) {
      throw new Error("upload failed")
    }
    return this.uploaded = uploaded
  }
}

/** An object representing a given source code. */
export class SourceCode {
  sourcePath?:  string
  /** URL pointing to Git repository containing the source code. */
  sourceRepo?:  string|URL
  /** Branch/tag pointing to the source commit. */
  sourceRef?:   string
  /** Whether the code contains uncommitted changes. */
  sourceDirty?: boolean

  constructor (properties: Partial<SourceCode> = {}) {
    assign(this, properties, 'SourceCode')
  }

  get [Symbol.toStringTag] () {
    return [
      this.sourcePath ? this.sourcePath : `(missing source)`,
      this.sourceRepo  && `(from ${this.sourceRepo})`,
      this.sourceRef   && `(at ${this.sourceRef})`,
      this.sourceDirty && `(modified)`
    ].filter(Boolean).join(' ')
  }

  toReceipt (): {
    sourcePath?:   string
    sourceRepo?:   string
    sourceRef?:    string
    sourceDirty?:  boolean
    [key: string]: unknown
  } {
    const { sourcePath, sourceRepo, sourceRef, sourceDirty } = this
    return { sourcePath, sourceRepo: sourceRepo?.toString(), sourceRef, sourceDirty }
  }

  /** Minimum required data to compile: path. */
  isValid () {
    return !!(this.sourcePath)
  }
}

export class RustSourceCode extends SourceCode {
  /** Path to root directory of crate or workspace. */
  cargoWorkspace?: string
  /** Name of crate in workspace. */
  cargoCrate?:     string
  /** List of crate features to enable during build. */
  cargoFeatures?:  string[]|Set<string>

  constructor (properties?: Partial<RustSourceCode>) {
    super(properties)
    assign(this, properties, 'RustSourceCode')
  }

  get [Symbol.toStringTag] () {
    return [
      this.cargoWorkspace
        ? (this.cargoCrate ? `crate ${this.cargoCrate} from` : 'unknown crate from')
        : undefined,
      super[Symbol.toStringTag],
    ].filter(Boolean).join(' ')
  }

  toReceipt (): ReturnType<SourceCode["toReceipt"]> & {
    cargoWorkspace?: string
    cargoCrate?:     string
    cargoFeatures?:  string[]
    [key: string]:   unknown
  } {
    const { cargoWorkspace, cargoCrate, cargoFeatures } = this
    return {
      ...super.toReceipt(),
      cargoWorkspace,
      cargoCrate,
      cargoFeatures: cargoFeatures ? [...cargoFeatures] : undefined
    }
  }

  /** Minimum required data to compile: path + crate name if workspace. */
  isValid () {
    return super.isValid() && (this.cargoWorkspace ? !!(this.cargoCrate) : true)
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
    assign(this, properties, 'CompiledCode')
  }

  get [Symbol.toStringTag] () {
    return [
      this.codePath && `${this.codePath}`,
      this.codeHash && `${this.codeHash}`,
      this.codeData && `(${this.codeData.length} bytes)`
    ].filter(Boolean).join(' ')
  }

  toReceipt (): {
    codeHash?: CodeHash
    codePath?: string
    [key: string]: unknown
  } {
    const { codeHash, codePath } = this
    return { codeHash, codePath: codePath?.toString() }
  }

  /** Minimum required data to upload: path or data */
  isValid (): this is CompiledCode & { codeHash: CodeHash } {
    return !!(this.codePath || this.codeData)
  }

  async fetch (): Promise<Uint8Array> {
    if (this.codeData) {
      return this.codeData
    }
    if (!this.codePath) {
      throw new Error('missing codePath')
    }
    if (typeof this.codePath === 'string') {
      return this.fetchFromPath(this.codePath)
    } else if (this.codePath instanceof URL) {
      return this.fetchFromURL(this.codePath)
    } else {
      throw new Error('invalid codePath')
    }
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
    assign(this, properties, 'UploadedCode')
  }

  toReceipt (): {
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

  isValid (): this is UploadedCode & { codeId: CodeId } {
    return !!this.codeId
  }
}
