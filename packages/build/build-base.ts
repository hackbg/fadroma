import { Builder, Contract } from '@fadroma/client'
import { CommandsConsole } from '@hackbg/komandi'
import { bold } from '@hackbg/konzola'
import $, { Path } from '@hackbg/kabinet'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

export const codeHashForPath = (location: string)=>codeHashForBlob(readFileSync(location))

export const codeHashForBlob = (blob: Uint8Array)=>Encoding.toHex(new Crypto.Sha256(blob).digest())

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
    this.script        = options.script ?? this.script
    this.noFetch       = options.noFetch ?? this.noFetch
    this.outputDirName = options.outputDirName ?? this.outputDirName
    this.toolchain     = options.toolchain ?? this.toolchain
    this.verbose       = options.verbose ?? this.verbose
  }

  /** The build script. */
  script:        string

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
    outputDir: string, crate?: string, gitRef: string = HEAD
  ): Contract<any>|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, gitRef))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.codeHashForPath(location.path)
        return new Contract({ crate, gitRef, artifact, codeHash })
      }
    }
    return null
  }

  codeHashForPath = codeHashForPath

}

export class BuildConsole extends CommandsConsole {
  name = 'Fadroma Build'
  buildingFromCargoToml (file: Path|string) {
    this.info('Building from', bold($(file).shortPath))
  }
  buildingFromBuildScript (file: Path, args: string[] = []) {
    this.info('Build script:', bold(file.shortPath))
    this.info('Build args:  ', bold(args.join(' ') || '(none)'))
  }
  buildingFromWorkspace (mounted: Path|string, ref: string = HEAD) {
    this.info(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }
  buildingOne (source: Contract<any>, prebuilt: Contract<any>|null = null) {
    if (prebuilt) {
      this.info('Reuse    ', bold($(prebuilt.artifact!).shortPath))
    } else {
      const { crate = '(unknown)', gitRef = 'HEAD' } = source
      this.info('Building', bold(crate), ...
        (gitRef === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(gitRef)])
    }
  }
  buildingMany (sources: Contract<any>[]) {
    for (const source of sources) {
      this.buildingOne(source, null)
    }
    this.info()
  }
}
