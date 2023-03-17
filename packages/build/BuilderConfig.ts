import { Builder } from '@fadroma/core'
import type { BuilderClass } from '@fadroma/core'

import $ from '@hackbg/file'
import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class BuilderConfig extends Config {

  constructor (
    options: Partial<BuilderConfig> = {},
    environment?: Environment
  ) {
    super(options, environment)
  }

  /** Builder to use */
  builder: string = this.getString('FADROMA_BUILDER', ()=>Object.keys(Builder.variants)[0])

  /** Whether the build process should print more detail to the console. */
  verbose: boolean = this.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)

  /** Whether the build log should be printed only on error, or always */
  quiet: boolean = this.getFlag('FADROMA_BUILD_QUIET', ()=>false)

  /** Project root. Defaults to current working directory. */
  project: string  = this.getString('FADROMA_PROJECT', ()=>this.environment.cwd)

  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean = !this.getFlag('FADROMA_REBUILD', ()=>false)

  /** Name of output directory. */
  outputDir: string = this.getString('FADROMA_ARTIFACTS', ()=>$(this.project).in('artifacts').path)

  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script: string  = this.getString('FADROMA_BUILD_SCRIPT',
    ()=>$(buildPackage).at('build.impl.mjs').path)

  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain: string = this.getString('FADROMA_RUST', ()=>'')

  /** Don't run "git fetch" during build. */
  noFetch: boolean = this.getFlag('FADROMA_NO_FETCH', ()=>false)

  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw: boolean = this.getFlag('FADROMA_BUILD_RAW', ()=>false)

  /** Whether to use Podman instead of Docker to run the build container. */
  podman: boolean = this.getFlag('FADROMA_BUILD_PODMAN', () =>
    this.getFlag('FADROMA_PODMAN', ()=>false))

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
    $B ??= Builder.variants[this.buildRaw?'Raw':'Container'] as unknown as BuilderClass<B>
    return new $B(this) as B
  }

}

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))
