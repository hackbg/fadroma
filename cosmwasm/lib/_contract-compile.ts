/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/

import { Console, Logged, bold, assign, base16, SHA256 } from '../Util.ts'
import { SourceCode } from './Source.ts'
import type { CodeHash } from '../../index.ts'

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

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

  status () {
    const canFetch      = !!this.codePath
    const canFetchInfo  = (!this.codePath) ? "can't fetch binary: codePath is not set" : ''
    const canUpload     = !!this.codeData || canFetch
    let canUploadInfo = ''
    if (!this.codeData && canFetch) {
      canUploadInfo = "uploading will fetch the binary from the specified path"
    }
    if (this.codeData && !this.codePath) {
      canUploadInfo = "uploading from buffer, codePath is unspecified"
    }
    return {
      canFetch,
      canFetchInfo,
      canUpload,
      canUploadInfo
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
    this.codeData = await this.fetchImpl()
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

  protected async fetchImpl () {
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


