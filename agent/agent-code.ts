import { Console, assign } from './agent-base'
import type { Class, Address, TxHash } from './agent-base'
import type { ChainId, Agent } from './agent-chain'

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

export class ContractCode {
  source?:   SourceCode
  builder?:  Builder
  compiled?: CompiledCode
  uploader?: Agent|Address
  uploaded?: UploadedCode
  deployer?: Agent|Address

  constructor (properties?: {
    source?:   Partial<SourceCode>,
    builder?:  Builder,
    compiled?: Partial<CompiledCode>,
    uploader?: Agent|Address,
    uploaded?: Partial<UploadedCode>,
    deployer?: Agent|Address,
  }) {
    if (properties?.source)   this.source = new SourceCode(properties.source)
    if (properties?.builder)  this.builder = properties?.builder
    if (properties?.compiled) this.compiled = new CompiledCode(properties.compiled)
    if (properties?.uploader) this.uploader = properties?.uploader
    if (properties?.uploaded) this.uploaded = new UploadedCode(properties.uploaded)
    if (properties?.deployer) this.deployer = properties?.deployer
  }

  /** Compile this contract, unless a valid binary is present and a rebuild is not requested. */
  async compile ({
    builder = this.builder,
    rebuild = false,
    ...buildOptions
  }: {
    builder?: Builder
    rebuild?: boolean
  } = {}): Promise<CompiledCode & Parameters<Builder["build"]>[1] & {
    codeHash: CodeHash
  }> {
    if (this.compiled?.isValid() && !rebuild) {
      return this.compiled
    }
    if (!builder) {
      throw new Error("can't compile: no builder")
    }
    if (!this.source?.isValid()) {
      throw new Error("can't compile: no source")
    }
    this.compiled = await builder.build(this.source, buildOptions)
    if (!this.compiled?.isValid()) {
      throw new Error("build failed")
    }
    return this.compiled
  }

  /** Upload this contract, unless a valid upload is present and a rebuild is not requested. */
  async upload ({
    builder  = this.builder,
    rebuild  = false,
    uploader = this.uploader,
    reupload = rebuild,
    ...uploadOptions
  }: Parameters<this["compile"]>[0] & Parameters<Agent["upload"]>[1] & {
    uploader?: Agent|Address
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
    const compiled = await this.compile({ builder, rebuild })
    this.uploaded = await uploader.upload(compiled, uploadOptions)
    if (!this.uploaded?.isValid()) {
      throw new Error("upload failed")
    }
    return this.uploaded
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
    return false
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
    assign(this, properties)
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
      throw new Error('Missing codePath')
    }
    if (typeof this.codePath === 'string') {
      return this.fetchFromPath(this.codePath)
    } else if (this.codePath instanceof URL) {
      return this.fetchFromURL(this.codePath)
    } else {
      throw new Error('Invalid codePath')
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
      return new Uint8Array(await (await fetch(url)).arrayBuffer())
    }
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
  /** extra info */
  uploadInfo?: string

  constructor (properties: Partial<UploadedCode> = {}) {
    assign(this, properties)
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

export abstract class Builder {
  static variants: Record<string, Class<Builder, any>> = {}

  log = new Console(this.constructor.name)

  /** Whether to enable build caching.
    * When set to false, this builder will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this builder implementation. */
  abstract id: string

  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (
    source: string|Partial<SourceCode>|Partial<CompiledCode>,
    ...args: any[]
  ): Promise<CompiledCode>

  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  abstract buildMany (
    sources: (string|Partial<CompiledCode>)[],
    ...args: unknown[]
  ): Promise<CompiledCode[]>
}

/** A builder that does nothing. Used for testing. */
export class StubBuilder extends Builder {
  caching = false

  id = 'stub'

  async build (
    source: string|Partial<SourceCode>, ...args: any[]
  ): Promise<CompiledCode> {
    return new CompiledCode({
      codePath: 'stub',
      codeHash: 'stub',
    })
  }

  async buildMany (
    sources: (string|Partial<CompiledCode>)[], ...args: unknown[]
  ): Promise<CompiledCode[]> {
    return Promise.all(sources.map(source=>new CompiledCode({
      codePath: 'stub',
      codeHash: 'stub',
    })))
  }
}
