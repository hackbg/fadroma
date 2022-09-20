/*
  Fadroma Build System
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import { bold } from '@hackbg/konzola'
import { Env, EnvConfig } from '@hackbg/konfizi'
import { CommandContext } from '@hackbg/komandi'
import $, { Path, OpaqueFile, OpaqueDirectory, TOMLFile, TextFile } from '@hackbg/kabinet'

import { Client, Contract, Builder, Deployment, HEAD } from '@fadroma/client'

import { default as simpleGit } from 'simple-git'

import { spawn                        } from 'child_process'
import { basename, resolve, dirname   } from 'path'
import { homedir, tmpdir              } from 'os'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, mkdtempSync    } from 'fs'

import { BuildConsole, LocalBuilder, buildPackage } from './build-base'
import { RawBuilder }    from './build-raw'
import { DockerBuilder } from './build-docker'

export async function build (
  crates:  string[]               = [],
  revision:  string                 = HEAD,
  config:  Partial<BuilderConfig> = new BuilderConfig(),
  builder: Builder                = getBuilder(config)
) {
  return await builder.buildMany(crates.map(crate=>new Contract({
    repository: config.project,
    workspace:  config.project,
    crate,
    revision
  })))
}

export class BuilderConfig extends EnvConfig {

  constructor (
    readonly env: Env    = process.env,
    readonly cwd: string = process.cwd(),
    defaults: Partial<BuilderConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }

  /** Project root. Defaults to current working directory. */
  project:    string  = this.getString ('FADROMA_PROJECT',          ()=>this.cwd)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw:   boolean = this.getBoolean('FADROMA_BUILD_RAW',        ()=>false)
  /** Whether to ignore existing build artifacts and rebuild contracts. */
  rebuild:    boolean = this.getBoolean('FADROMA_REBUILD',          ()=>false)
  /** Whether not to run `git fetch` during build. */
  noFetch:    boolean = this.getBoolean('FADROMA_NO_FETCH',         ()=>false)
  /** Which version of the Rust toolchain to use, e.g. `1.59.0` */
  toolchain:  string  = this.getString ('FADROMA_RUST',             ()=>'')

  /** Script that runs the actual build, e.g. build.impl.mjs */
  script:     string  = this.getString ('FADROMA_BUILD_SCRIPT',     ()=>
                                        resolve(buildPackage, 'build.impl.mjs'))
  /** Docker image to use for dockerized builds. */
  image:      string  = this.getString ('FADROMA_BUILD_IMAGE',      ()=>
                                        'ghcr.io/hackbg/fadroma:unstable')
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string  = this.getString ('FADROMA_BUILD_DOCKERFILE', ()=>
                                        resolve(buildPackage, 'build.Dockerfile'))

  getBuildContext (): BuildContext {
    return new BuildContext(this)
  }

}

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

export class BuildContext extends CommandContext {

  constructor (options: Partial<BuildContext> = {}) {
    super('build', 'build commands')
    this.config  = options.config  ?? this.config  ?? new BuilderConfig(this.env, this.cwd, options.config)
    this.builder = options.builder ?? this.builder ?? getBuilder(this.config)
  }

  /** Setting for the build context. */
  config?:    BuilderConfig

  /** Knows how to build contracts for a target. */
  builder?:   Builder

  /** Path to Cargo workspace. */
  workspace:  string = process.cwd()

  /** Path to local Git repository. */
  repository: string = this.workspace

  /** Git reference from which to build sources. */
  revision:   string = HEAD

  /** Path to `.git` directory. */
  gitDir:     string = `${this.repository}/.git`

  buildFromPath = this.command('one', 'build one crate from working tree', (
    path: string|Path = process.argv[2],
    args: string[]            = process.argv.slice(3)
  ) => {
    path = $(path)
    if (path.isDirectory()) {
      return this.buildFromDirectory(path.as(OpaqueDirectory))
    } else if (path.isFile()) {
      return this.buildFromFile(path.as(OpaqueFile), args)
    } else {
      return this.printUsage()
    }
  })

  buildFromDirectory = (dir: OpaqueDirectory) => {
    const cargoToml = dir.at('Cargo.toml').as(TOMLFile)
    if (cargoToml.exists()) {
      return this.buildFromCargoToml(cargoToml as CargoTOML)
    } else {
      this.printUsage()
    }
  }

  buildFromFile = async (file: TOMLFile<unknown>|OpaqueFile, args: string[]) => {
    if (file.name === 'Cargo.toml') {
      return this.buildFromCargoToml(file as CargoTOML)
    } else {
      return this.buildFromModule(file as OpaqueFile, args)
    }
  }

  buildFromCargoToml = async (
    cargoToml: CargoTOML,
    repository      = process.env.FADROMA_BUILD_REPO_ROOT      || cargoToml.parent,
    workspace = process.env.FADROMA_BUILD_WORKSPACE_ROOT || cargoToml.parent
  ) => {
    this.log.buildingFromCargoToml(cargoToml)
    const source = new Contract({
      repository,
      workspace,
      crate: (cargoToml.as(TOMLFile).load() as any).package.name
    })
    try {
      (this.builder as LocalBuilder).caching = false
      const result = await this.builder!.build(source)
      const { artifact, codeHash } = result
      this.log.info('Built:    ', bold($(artifact!).shortPath))
      this.log.info('Code hash:', bold(codeHash!))
      this.exit(0)
      return result
    } catch (e) {
      this.log.error(`Build failed.`)
      this.log.error(e)
      this.exit(5)
    }
  }

  buildFromModule = async (script: OpaqueFile, args: string[]) => {
    this.log.buildingFromBuildScript(script, args)
    const {default: BuildContext} = await import(script.path)
    const commands = new BuildContext(this)
    const T0 = + new Date()
    try {
      const result = await commands.run(args)
      const T1 = + new Date()
      this.log.info(`Build finished in ${T1-T0}msec.`)
      return result
    } catch (e: any) {
      const T1 = + new Date()
      this.log.error(`Build failed in ${T1-T0}msec: ${e.message}`)
      this.log.error(e)
      throw e
    }
  }

  printUsage = () => {
    this.log.info(`
      Usage:
        fadroma-build path/to/crate
        fadroma-build path/to/Cargo.toml
        fadroma-build buildConfig.{js|ts}`)
    this.exit(6)
    return true
  }

  log = new BuildConsole('Fadroma.BuildContext')

}

/** Get a builder based on the builder config. */
export function getBuilder (config: Partial<BuilderConfig> = new BuilderConfig()) {
  if (config.buildRaw) {
    return new RawBuilder({ ...config, caching: !config.rebuild })
  } else {
    return new DockerBuilder({ ...config, caching: !config.rebuild })
  }
}

export default new BuildContext()

export { getGitDir, DotGit } from './build-history'
export { LocalBuilder, RawBuilder, DockerBuilder, BuildConsole, buildPackage }
