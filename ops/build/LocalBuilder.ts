import Console from '../Console'
import type { BuilderConfig } from '../Config'

import { Builder, HEAD } from '@fadroma/agent'
import type { Class, Built } from '@fadroma/agent'

import $, { Path, BinaryFile, TOMLFile, OpaqueFile, OpaqueDirectory } from '@hackbg/file'
import { bold } from '@hackbg/logs'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export default abstract class LocalBuilder extends Builder {

  constructor (options: Partial<BuilderConfig>) {
    super('local builder', 'local builder')
    this.workspace = options.project   ?? this.workspace
    this.noFetch   = options.noFetch   ?? this.noFetch
    this.toolchain = options.toolchain ?? this.toolchain
    this.verbose   = options.verbose   ?? this.verbose
    this.quiet     = options.quiet     ?? this.quiet
    this.outputDir = $(options.outputDir!).as(OpaqueDirectory)
    if (options.script) this.script = options.script
  }
  /** Logger. */
  log = new Console('Local Builder')
  /** The build script. */
  script?:    string
  /** The project workspace. */
  workspace?: string
  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:    boolean     = false
  /** Name of directory where build artifacts are collected. */
  outputDir:  OpaqueDirectory
  /** Version of Rust toolchain to use. */
  toolchain:  string|null = null
  /** Whether the build process should print more detail to the console. */
  verbose:    boolean     = false
  /** Whether the build log should be printed only on error, or always */
  quiet:      boolean     = false
  /** Whether to enable caching. */
  caching:    boolean     = true
  /** Default Git reference from which to build sources. */
  revision:   string = HEAD

  readonly id: string = 'local'

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, revision: string = HEAD
  ): Built|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, revision))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.hashPath(location)
        return { crate, revision, artifact, codeHash }
      }
    }
    return null
  }

  hashPath (location: string|Path) {
    return $(location).as(BinaryFile).sha256
  }

}

export const artifactName = (crate: string, ref: string) =>
  `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) =>
  ref.replace(/\//g, '_')
