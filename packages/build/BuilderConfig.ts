import { Builder } from '@fadroma/core'
import type { BuilderClass } from '@fadroma/core'

import $ from '@hackbg/file'
import { EnvConfig } from '@hackbg/conf'
import type { Env } from '@hackbg/conf'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class BuilderConfig extends EnvConfig {

  constructor (
    defaults: Partial<BuilderConfig> = {},
    readonly env: Env    = process.env,
    readonly cwd: string = process.cwd(),
  ) {
    super(env, cwd)
    this.override(defaults)
  }

  /** Whether the build process should print more detail to the console. */
  verbose: boolean = this.getBoolean('FADROMA_BUILD_VERBOSE', ()=>false)

  /** Whether the build log should be printed only on error, or always */
  quiet: boolean = this.getBoolean('FADROMA_BUILD_QUIET', ()=>false)

  /** Project root. Defaults to current working directory. */
  project: string  = this.getString('FADROMA_PROJECT', ()=>this.cwd)

  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean = !this.getBoolean('FADROMA_REBUILD', ()=>false)

  /** Name of output directory. */
  outputDir: string = this.getString('FADROMA_ARTIFACTS', ()=>$(this.project).in('artifacts').path)

  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script: string  = this.getString('FADROMA_BUILD_SCRIPT',
    ()=>$(buildPackage).at('build.impl.mjs').path)

  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain: string = this.getString('FADROMA_RUST', ()=>'')

  /** Don't run "git fetch" during build. */
  noFetch: boolean = this.getBoolean('FADROMA_NO_FETCH', ()=>false)

  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw: boolean = this.getBoolean('FADROMA_BUILD_RAW', ()=>false)

  /** Whether to use Podman instead of Docker to run the build container. */
  podman: boolean = this.getBoolean('FADROMA_BUILD_PODMAN', () =>
    this.getBoolean('FADROMA_PODMAN', ()=>false))

  /** Path to Docker API endpoint. */
  dockerSocket: string = this.getString('FADROMA_DOCKER',
    ()=>'/var/run/docker.sock')

  /** Docker image to use for dockerized builds. */
  dockerImage: string = this.getString('FADROMA_BUILD_IMAGE',
    ()=>'ghcr.io/hackbg/fadroma:unstable')

  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string = this.getString('FADROMA_BUILD_DOCKERFILE',
    ()=>$(buildPackage).at('build.Dockerfile').path)

  /** Get a configured builder. */
  getBuilder <B extends Builder> ($B?: BuilderClass<B>): B {
    $B ??= Builder.variants[this.buildRaw?'raw-local':'docker-local'] as unknown as BuilderClass<B>
    return new $B(this) as B
  }

}

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))
