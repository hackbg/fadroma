import { Builder, Contract, HEAD } from '@fadroma/client'
import $, { Path, BinaryFile } from '@hackbg/kabinet'
import { Encoding, Crypto } from '@hackbg/formati'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

export interface LocalBuilderOptions {
  /** Script that implements the actual build procedure. */
  script:        string
  /** Don't run "git fetch" during build. */
  noFetch:       boolean
  /** Name of output directory. */
  outputDirName: string
  /** Which version of the language toolchain to use. */
  toolchain:     string
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching:       boolean
}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalBuilder extends Builder {

  readonly id: string = 'local'

  constructor (options: Partial<LocalBuilder> = {}) {
    super()
    if (options.script) this.script = options.script
    this.noFetch       = options.noFetch ?? this.noFetch
    this.outputDirName = options.outputDirName ?? this.outputDirName
    this.toolchain     = options.toolchain ?? this.toolchain
    this.verbose       = options.verbose ?? this.verbose
  }

  /** The build script. */
  script?:       string

  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:       boolean     = false

  /** Name of directory where build artifacts are collected. */
  outputDirName: string      = 'artifacts'

  /** Version of Rust toolchain to use. */
  toolchain:     string|null = null

  /** Whether the build process should print more detail to the console. */
  verbose:       boolean     = false

  /** Whether to enable caching. */
  caching:       boolean     = true

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, revision: string = HEAD
  ): Contract<any>|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, revision))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.hashPath(location)
        return new Contract({ crate, revision, artifact, codeHash })
      }
    }
    return null
  }

  hashPath = (location: string|Path) => $(location).as(BinaryFile).sha256

}

export const artifactName = (crate: string, ref: string) => `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) => ref.replace(/\//g, '_')
