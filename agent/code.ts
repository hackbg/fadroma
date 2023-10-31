/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, assign } from './base'
import type { Class, Address, TxHash } from './base'
import type { ChainId, Agent } from './chain'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

assign.allow('SourceCode', [
  'repository', 'revision', 'dirty', 'workspace', 'crate', 'features'
] as Array<keyof Omit<SourceCode, symbol>>)

assign.allow('CompiledCode', [
  'codeHash', 'buildInfo', 'codePath', 'codeData'
] as Array<keyof Omit<CompiledCode, symbol>>)

assign.allow('UploadedCode', [
  'codeHash', 'chainId', 'codeId', 'uploadTx', 'uploadBy', 'uploadGas', 'uploadInfo',
] as Array<keyof Omit<UploadedCode, symbol>>)

const console = new Console()

export abstract class Compiler {
  log = new Console(this.constructor.name)

  /** Whether to enable build caching.
    * When set to false, this compiler will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this compiler implementation. */
  abstract id: string

  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (source: string|Partial<SourceCode>, ...args: unknown[]):
    Promise<CompiledCode>

  /** Default implementation of buildMany is parallel.
    * Compiler implementations override this, though. */
  abstract buildMany (sources: (string|Partial<CompiledCode>)[], ...args: unknown[]):
    Promise<CompiledCode[]>
}

export class ContractCode {
  source?:   SourceCode
  compiler?: Compiler
  compiled?: CompiledCode
  uploader?: Agent|Address
  uploaded?: UploadedCode
  deployer?: Agent|Address

  constructor (properties?: {
    source?:   Partial<SourceCode>,
    compiler?: Compiler,
    compiled?: Partial<CompiledCode>,
    uploader?: Agent|Address,
    uploaded?: Partial<UploadedCode>,
    deployer?: Agent|Address,
  }) {
    let { source, compiler, compiled, uploader, uploaded, deployer } = properties || {}
    if (source) {
      if (!(source instanceof SourceCode)) {
        source = new SourceCode(source)
      }
      this.source = source as SourceCode
    }
    if (compiler) {
      this.compiler = compiler
    }
    if (properties?.compiled) {
      if (!(compiled instanceof CompiledCode)) {
        compiled = new CompiledCode(compiled)
      }
      this.compiled = compiled as CompiledCode
    }
    if (uploader) {
      this.uploader = uploader
    }
    if (properties?.uploaded) {
      if (!(uploaded instanceof UploadedCode)) {
        uploaded = new UploadedCode(uploaded)
      }
      this.uploaded = uploaded as UploadedCode
    }
    if (deployer) {
      this.deployer = deployer
    }
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
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL
  /** Branch/tag pointing to the source commit. */
  revision?:   string
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean
  /** Path to root directory of crate or workspace. */
  workspace?:  string
  /** Name of crate in workspace. */
  crate?:      string
  /** List of crate features to enable during build. */
  features?:   string[]

  constructor (properties: Partial<SourceCode> = {}) {
    assign(this, properties, 'SourceCode')
  }

  get [Symbol.toStringTag] () {
    return this.specifier
  }

  toReceipt () {
    return {
      repository: this.repository,
      revision:   this.revision,
      dirty:      this.dirty,
      workspace:  this.workspace,
      crate:      this.crate,
      features:   this.features?.join(', '),
    }
  }

  /** @returns a string in the format `repo@ref|crate[+flag][+flag]...` */
  get specifier (): string {
    const { repository, revision, crate, features, dirty } = this
    let result = `${repository}@${revision}|${crate}`
    if (features && features.length > 0) result = `${result}+${features.join('+')}`
    if (dirty) result = `(*)${result}`
    return result
  }

  isValid () {
    return !!(this.repository || this.workspace)
  }
}

/** An object representing a given compiled binary. */
export class CompiledCode {
  buildInfo?: string
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
    let tags = [
      this.codePath && `${this.codePath}`,
      this.codeHash && `${this.codeHash}`,
      this.codeData && `(${this.codeData.length} bytes)`
    ]
    return tags.filter(Boolean).join(' ')
  }

  isValid (): this is CompiledCode & { codeHash: CodeHash } {
    return !!this.codeHash
  }

  toReceipt () {
    return {
      codeHash:  this.codeHash,
      codePath:  this.codePath,
      buildInfo: this.buildInfo,
    }
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

}

  //protected addCodeHash (uploadable: Partial<UploadedCode> & {
    //name: string,
    //codePath?: string|URL
  //}) {
    //if (!uploadable.codeHash) {
      //if (uploadable.codePath) {
        //uploadable.codeHash = base16.encode(sha256(this.fetchSync(uploadable.codePath)))
        //this.log(`hashed ${String(uploadable.codePath)}:`, uploadable.codeHash)
      //} else {
        //this.log(`no artifact, can't compute code hash for: ${uploadable?.name||'(unnamed)'}`)
      //}
    //}
  //}

  //protected async fetch (path: string|URL): Promise<Uint8Array> {
    //return await Promise.resolve(this.fetchSync(path))
  //}

  //protected fetchSync (path: string|URL): Uint8Array {
    //return $(fileURLToPath(new URL(path, 'file:'))).as(BinaryFile).load()
  //}

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
  /** extra info */
  uploadInfo?: string

  constructor (properties: Partial<UploadedCode> = {}) {
    assign(this, properties, 'UploadedCode')
  }

  toReceipt () {
    return {
      codeHash: this.codeHash,
      chainId:  this.chainId,
      codeId:   this.codeId,
      uploadBy: this.uploadBy,
      uploadTx: this.uploadTx,
    }
  }

  isValid (): this is UploadedCode & { codeId: CodeId } {
    return !!this.codeId
  }
}
