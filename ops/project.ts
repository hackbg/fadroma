/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Console, Error,
  UploadedCode, ContractInstance, Deployment,
  UploadStore, DeployStore,
  bold, timestamp,
} from '@fadroma/connect'
import type {
  CompiledCode, ChainId,
} from '@fadroma/connect'

import $, {
  TextFile, OpaqueDirectory,
  YAMLFile,
  TOMLFile,
  JSONFile, JSONDirectory
} from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { CommandContext } from '@hackbg/cmds'

import { Compiler } from './build'
import { Config, version } from './config'
import { Devnet } from './devnets'
import { ProjectWizard, toolVersions } from './wizard'
import { writeProject } from './scaffold'
import { JSONFileUploadStore, JSONFileDeployStore } from './stores'

import { execSync } from 'node:child_process'

const console = new Console(`@hackbg/fadroma ${version}`)

export type ProjectOptions = Omit<Partial<Project>, 'root'|'templates'|'uploadStore'|'deployStore'> & {
  root?:        OpaqueDirectory|string,
  templates?:   Record<string, Partial<UploadedCode>>
  uploadStore?: string|UploadStore
  deployStore?: string|DeployStore
}

export class Project extends CommandContext {
  log = new Console(`Fadroma ${version}`) as any
  /** Fadroma settings. */
  config:      Config
  /** Name of the project. */
  name:        string
  /** Root directory of the project. */
  root:        OpaqueDirectory
  /** Compiler to compile the contracts. */
  compiler:    Compiler
  /** Stores the upload receipts. */
  uploadStore: UploadStore
  /** Stores the deploy receipts. */
  deployStore: DeployStore
  /** Default deployment class. */
  Deployment = Deployment

  static wizard = (...args: any[]) => new ProjectWizard().createProject(this, ...args)

  static load = (path: string|OpaqueDirectory = process.cwd()): Project|null => {
    const configFile = $(path, 'fadroma.yml').as(YAMLFile)
    if (configFile.exists()) {
      return new Project(configFile.load() as ProjectOptions)
    } else {
      return null
    }
  }

  constructor (options?: ProjectOptions) {
    super()
    this.config = options?.config ?? new Config()
    this.root = $(options?.root || this.config.root || process.cwd()).as(OpaqueDirectory)
    this.name = options?.name || this.root.name
    this.log.label = this.exists() ? this.name : `@hackbg/fadroma ${version}`

    if (this.exists()) this.log
      .info('at', bold(this.root.path))
      .info(`on`, bold(this.config.connect.chainId))

    if (options?.compiler instanceof Compiler) {
      this.compiler = options.compiler
    } else {
      this.compiler = getCompiler({
        outputDir: this.dirs.wasm.path
      })
    }

    if (options?.uploadStore instanceof UploadStore) {
      this.uploadStore = options.uploadStore
    } else if (typeof options?.uploadStore === 'string') {
      this.uploadStore = new JSONFileUploadStore(options.uploadStore)
    } else {
      this.uploadStore = new UploadStore()
    }

    if (options?.deployStore instanceof DeployStore) {
      this.deployStore = options.deployStore
    } else if (typeof options?.deployStore === 'string') {
      this.deployStore = new JSONFileDeployStore(options.deployStore)
    } else {
      this.deployStore = new DeployStore()
    }
  }

  /** Load and execute the default export of an ES module,
    * passing this Project instance as first argument. */
  runScript = this.command(
    'run', 'execute a script',
    async (script?: string, ...args: string[]) => {
      if (!script) {
        throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
      }
      if (!$(script).exists()) {
        throw new Error(`${script} doesn't exist`)
      }
      this.log.log(`Running ${script}`)
      const path = $(script).path
      //@ts-ignore
      const { default: main } = await import(path)
      if (typeof main === 'function') {
        return main(this, ...args)
      } else {
        this.log.info(`${$(script).shortPath} does not have a default export.`)
      }
    })

  /** Print the current status of Fadroma, the active devnet, project, and deployment.
    * @returns this */
  status = this.command(
    'status', 'show the status of the project',
    () => {
      toolVersions()
      const agent = this.config.connect.authenticate()
      this.log.info('Project name:           ', bold(this.name))
      this.log.info('Project root:           ', bold(this.root.path))
      this.log.info('Optimized contracts at: ', bold(this.dirs.wasm.shortPath))
      this.log.info('Contract checksums at:  ', bold(this.dirs.wasm.shortPath))
      this.log.br()
      this.log.info('Chain type:    ', bold(agent?.constructor.name))
      this.log.info('Chain mode:    ', bold(agent?.mode))
      this.log.info('Chain ID:      ', bold(agent?.chainId))
      if (!agent?.isMocknet) {
        this.log.info('Chain URL:     ', bold(agent?.url.toString()))
      }
      this.log.info('Agent address: ', bold(agent.address))
      this.log.br()
      if (this.dirs.state.exists()) {
        this.log.info('Chain-specific state at:', bold(this.dirs.state.shortPath))
        const states = this.dirs.state.list()
        if (states && states.length > 0) {
          this.log.info('Recorded state for:     ', bold(this.dirs.state.list()?.join(', ')))
        } else {
          this.log.info('No transactions recorded.')
        }
        const deployment = this.getDeployment()
        if (deployment) {
          this.log.br()
          this.log.deployment(deployment)
        } else {
          this.log.info('No active deployment.')
        }
      } else {
        this.log.info('No active project.')
      }
      this.log.br()
      return this
    })

  createProject = this.command(
    'create', 'create a new project',
    Project.wizard)

  /** Write the files representing the described project to the root directory.
    * @returns this */
  create () {
    writeProject(this)
    this.log("created at", this.root.shortPath)
    return this
  }

  /** Builds one or more named templates, or all templates if no arguments are passed. */
  build = this.command(
    'build', 'build the project or specific contracts from it',
    async (...names: string[]): Promise<CompiledCode[]> => {
      if (names.length < 1) {
        names = Object.keys(this.templates)
        if (names.length > 0) {
          this.log.log('Building all:', names.join(', '))
          return this.build(...names)
        }
        this.log.warn('This would build all contracts, but no contracts are defined.')
        return []
      }
      const sources = names.map(name=>this.getTemplate(name)).filter((template, i)=>{
        if (!template) this.log.warn(`No such template in project: ${names[i]}`)
        return !!template
      })
      if (sources.length < 1) {
        this.log.warn('Nothing to build.')
        return []
      }
      return await this.compiler.buildMany(sources)
    })

  rebuild = this.command(
    'rebuild', 'rebuild the project or specific contracts from it',
    (...names: string[]): Promise<CompiledCode[]> => {
      this.compiler.caching = false
      return this.build(...names)
    })

  /** Upload one or more named templates, or all templates if no arguments are passed.
    * Build templates with missing artifacts if sources are available. */
  upload = this.command(
    'upload', 'upload the project or specific contracts from it',
    async (...names: string[]): Promise<UploadedCode[]> => {
      let sources: Partial<CompiledCode>[] = await this.getSources(names)
      if (this.compiler) sources = await this.compiler.buildMany(sources)
      const options = { uploadStore: this.uploadStore, reupload: false }
      const agent = this.config.connect.authenticate()
      return Object.values(await agent.uploadMany(sources, options))
    })

  reupload = this.command(
    'reupload', 'reupload the project or specific contracts from it',
    async (...names: string[]): Promise<UploadedCode[]> => {
      let sources: Partial<CompiledCode>[] = await this.getSources(names)
      if (this.compiler) sources = await this.compiler.buildMany(sources)
      const options = { uploadStore: this.uploadStore, reupload: true }
      const agent = this.config.connect.authenticate()
      return Object.values(await agent.uploadMany(sources, options))
    })

  protected async getSources (names: string[]) {
    if (names.length < 1) {
      names = Object.keys(this.templates)
      if (names.length > 0) {
        this.log.log('Uploading all:', names.join(', '))
        return await this.upload(...names)
      }
      this.log.warn('Uploading 0 contracts.')
      return []
    }
    const sources = names.map(name=>this.getTemplate(name)).filter((template, i)=>{
      if (!template) this.log.warn(`No such template in project: ${names[i]}`)
      return !!template
    }) as UploadedCode[]
    if (sources.length < 1) {
      this.log.warn('Nothing to upload.')
      return []
    }
    return sources
  }
    
  deploy = this.command(
    'deploy', 'deploy this project or continue an interrupted deployment',
    async (...args: string[]) => {
      const deployment: Deployment = this.getDeployment() || await this.createDeployment()
      this.log.info(`deployment:`, bold(deployment.name), `(${deployment.constructor?.name})`)
      const agent = this.config.connect.authenticate()
      await deployment.deploy({
        compiler: this.config.build.getCompiler(),
        uploader: agent,
        deployer: agent,
      })
      await this.log.deployment(deployment)
      if (!agent.isMocknet) {
        await this.selectDeployment(deployment.name)
      }
      return deployment
    })

  redeploy = this.command(
    'redeploy', 'redeploy this project from scratch',
    async (...args: string[]) => {
      await this.createDeployment()
      return await this.deploy(...args)
    })

  createDeployment (name: string = timestamp()) {
    const deployment = new this.Deployment({ name })
    this.deployStore.set(name, deployment)
    return this.selectDeployment(name)
  }

  selectDeployment = this.command(
    'select', `activate another deployment`, 
    async (name?: string): Promise<Deployment|undefined> => {
      const store = this.deployStore
      if (!store) {
        this.log.error('No deployment store.')
        return
      }
      if ([...store.keys()].length < 1) {
        throw new Error('No deployments in this store')
      }
      let deployment: Deployment
      if (name) {
        return new this.Deployment(store.get(name))
      } else if (process.stdout.isTTY) {
        name = await ProjectWizard.selectDeploymentFromStore(store)
        if (name) {
          return new this.Deployment(store.get(name))
        } else {
          throw new Error(`No such deployment: ${name}`)
        }
      }
    })

  exportDeployment = this.command(
    'export', `export current deployment to JSON`,
    async (path?: string) => {
      const deployment = await this.selectDeployment()
      if (!deployment) {
        throw new Error("deployment not found")
      }
      if (!path) path = process.cwd()
      // If passed a directory, generate file name
      let file = $(path)
      if (file.isDirectory()) file = file.in(`${name}_@_${timestamp()}.json`)
      // Serialize and write the deployment.
      const state = deployment.toReceipt()
      file.as(JSONFile).makeParent().save(state)
      this.log.info('saved', Object.keys(state).length, 'contracts to', bold(file.shortPath))
    })

  resetDevnets = this.command(
    'reset', 'stop and erase running devnets',
    (...ids: ChainId[]) => {
      return Devnet.deleteMany(this.root.in('state'), ids)
    })

  /** Get the active deployment or a named deployment.
    * @returns Deployment|null */
  getDeployment (
    name?: string,
    templates: Record<string, Partial<UploadedCode>> = {},
    contracts: Record<string, Partial<ContractInstance>> = {},
  ): InstanceType<typeof this.Deployment> {
    if (!name) {
      throw new Error("missing deployment name")
    }
    if (this.deployStore.has(name)) {
      return this.Deployment.fromReceipt(this.deployStore.get(name)!)
    } else {
      throw new Error(`deployment not found: ${name}`)
    }
  }

  /** @returns stateless handles for the subdirectories of the project. */
  get dirs () {
    return {
      src:   this.root.in('src').as(OpaqueDirectory),
      wasm:  this.root.in('wasm').as(OpaqueDirectory),
      state: this.root.in('state').as(OpaqueDirectory)
    }
  }

  /** @returns stateless handles for various config files that are part of the project. */
  get files () {
    const { src, wasm, state } = this.dirs
    return {
      cargoToml:      this.root.at('Cargo.toml').as(TOMLFile),
      dockerfile:     null,
      droneWorkflow:  null,
      envfile:        this.root.at('.env').as(TextFile),
      fadromaYaml:    this.root.at('fadroma.yml').as(YAMLFile),
      githubWorkflow: null,
      gitignore:      this.root.at('.gitignore').as(TextFile),
      packageJson:    this.root.at('package.json').as(JSONFile),
      apiIndex:       this.root.at('index.ts').as(TextFile),
      projectIndex:   this.root.at('fadroma.config.ts').as(TextFile),
      testIndex:      this.root.at('test.ts').as(TextFile),
      readme:         this.root.at('README.md').as(TextFile),
      shellNix:       this.root.at('shell.nix').as(TextFile),
    }
  }

  /** @returns stateless handles for the contract crates
    * corresponding to templates in fadroma.yml */
  get crates () {
    const crates: Record<string, ProjectCrate> = {}
    for (const [name, template] of Object.entries(this.templates)) {
      if (template.crate) crates[name] = new ProjectCrate(this, template.crate)
    }
    return crates
  }

  /** @returns Boolean whether the project (as defined by fadroma.yml in root) exists */
  exists () {
    return this.files.fadromaYaml.exists()
  }

  listDeployments () {
    return this.log.deploy.deploymentList(
      this.config.connect.chainId??'(unspecified)', this.deployStore
    )
  }

  /** Create a Git repository in the project directory and make an initial commit.
    * @returns this */
  gitSetup () {
    this.runShellCommands(
      'git --no-pager init',
      'git --no-pager add .',
      'git --no-pager status',
      'git --no-pager commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git --no-pager log",
    )
    return this
  }

  /** @returns this */
  gitCommit (message: string = "") {
    this.runShellCommands(
      'git --no-pager add .',
      'git --no-pager status',
      `git --no-pager commit -m ${message}`,
    )
    return this
  }

  /** @returns this */
  npmInstall ({ npm, yarn, pnpm }: any = toolVersions()) {
    if (pnpm) {
      this.runShellCommands('pnpm i')
    } else if (yarn) {
      this.runShellCommands('yarn')
    } else {
      this.runShellCommands('npm i')
    }
    return this
  }

  /** @returns this */
  cargoUpdate () {
    this.runShellCommands('cargo update')
    return this
  }

  /** Run one or more external commands in the project root. */
  runShellCommands (...cmds: string[]) {
    cmds.map(cmd=>execSync(cmd, { cwd: this.root.path, stdio: 'inherit' }))
  }

}

/** Represents a crate containing a contract. */
export class ProjectCrate {
  /** Root directory of crate. */
  readonly dir:       OpaqueDirectory
  /** Crate manifest. */
  readonly cargoToml: TextFile
  /** Directory containing crate sources. */
  readonly srcDir:    OpaqueDirectory
  /** Root module of Rust crate. */
  readonly libRs:     TextFile

  constructor (
    project: { dirs: { src: Path } },
    /** Name of crate */
    readonly name: string,
    /** Features of the 'fadroma' dependency to enable. */
    readonly features: string[] = ['scrt']
  ) {
    this.dir = project.dirs.src.in(name).as(OpaqueDirectory)
    this.cargoToml = this.dir.at('Cargo.toml').as(TextFile)
    this.srcDir = this.dir.in('src').as(OpaqueDirectory)
    this.libRs  = this.srcDir.at('lib.rs').as(TextFile)
  }

  create () {

    this.cargoToml.save([
      `[package]`, `name = "${this.name}"`, `version = "0.0.0"`, `edition = "2021"`,
      `authors = []`, `keywords = ["fadroma"]`, `description = ""`, `readme = "README.md"`, ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { version = "0.8.7", features = ${JSON.stringify(this.features)} }`,
      `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
    ].join('\n'))

    this.srcDir.make()

    this.libRs.save([
      `//! Created by [Fadroma](https://fadroma.tech).`, ``,
      `#[fadroma::dsl::contract] pub mod contract {`,
      `    use fadroma::{*, dsl::*, prelude::*};`,
      `    impl Contract {`,
      `        #[init(entry_wasm)]`,
      `        pub fn new () -> Result<Response, StdError> {`,
      `            Ok(Response::default())`,
      `        }`,
      `        // #[execute]`,
      `        // pub fn my_tx_1 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `        //     Ok(Response::default())`,
      `        // }`,
      `        // #[execute]`,
      `        // pub fn my_tx_2 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `        //     Ok(Response::default())`,
      `        // }`,
      `        // #[query]`,
      `        // pub fn my_query_1 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `        //     Ok(())`, '',
      `        // }`,
      `        // #[query]`,
      `        // pub fn my_query_2 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `        //     Ok(())`, '',
      `        // }`,
      `    }`,
      `}`,
    ].join('\n'))

  }

}
