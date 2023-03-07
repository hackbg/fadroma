import BuildConsole from './BuildConsole'

import { Builder, HEAD } from '@fadroma/core'
import type { Class, Built } from '@fadroma/core'

import $, { Path, BinaryFile, TOMLFile, OpaqueFile, OpaqueDirectory } from '@hackbg/file'
import { Env, EnvConfig } from '@hackbg/conf'
import { bold } from '@hackbg/logs'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import BuilderConfig from './BuilderConfig'

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export default abstract class LocalBuilder extends Builder {

  constructor (options: Partial<BuilderConfig>) {
    super('local builder', 'local builder')
    this.config = new BuilderConfig(options, this.env, this.cwd)
    this.noFetch   = options.noFetch   ?? this.noFetch
    this.toolchain = options.toolchain ?? this.toolchain
    this.verbose   = options.verbose   ?? this.verbose
    this.quiet     = options.quiet     ?? this.quiet
    this.outputDir = $(options.outputDir!).as(OpaqueDirectory)
    if (options.script) this.script = options.script
  }
  /** Logger. */
  log = new BuildConsole('Local Builder')
  /** Settings. */
  config:     BuilderConfig
  /** The build script. */
  script?:    string
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

  printUsage () {
    this.log.usage()
    this.exit(6)
    return true
  }

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
