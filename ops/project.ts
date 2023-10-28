/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Console, Error, ContractUpload, ContractInstance, Deployment,
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
import { CommandContext } from '@hackbg/cmds'

import { getBuilder, Builder, ContractCrate } from './build'
import { Config, version } from './config'
import { Devnet } from './devnet'
import { ProjectWizard, toolVersions } from './wizard'
import { writeProject } from './scaffold'
import { UploadStore, FSUploadStore } from './upload'
import { DeployStore, FSDeployStore } from './deploy'

import { execSync } from 'node:child_process'

const console = new Console(`@hackbg/fadroma ${version}`)

export type ProjectOptions = Omit<Partial<Project>, 'root'|'templates'|'uploadStore'|'deployStore'> & {
  root?:        OpaqueDirectory|string,
  templates?:   Record<string, Partial<ContractUpload>>
  uploadStore?: string|UploadStore
  deployStore?: string|DeployStore
}

export class Project extends CommandContext {

  log = new Console(`Fadroma ${version}`) as any

  /** Fadroma settings. */
  config: Config

  /** Name of the project. */
  name: string

  /** Root directory of the project. */
  root: OpaqueDirectory

  /** Default deployment class. */
  Deployment = Deployment

  /** Builder to compile the contracts. */
  builder: Builder

  /** Stores the upload receipts. */
  uploadStore: UploadStore

  /** Stores the deploy receipts. */
  deployStore: DeployStore

  templates: Record<any, any> = {}

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
      .info(`on`, bold(this.config.chainId))

    if (options?.builder instanceof Builder) {
      this.builder = options.builder
    } else {
      this.builder = getBuilder({
        outputDir: this.dirs.wasm.path
      })
    }

    if (options?.uploadStore instanceof UploadStore) {
      this.uploadStore = options.uploadStore
    } else if (typeof options?.uploadStore === 'string') {
      this.uploadStore = new FSUploadStore(options.uploadStore)
    } else {
      this.uploadStore = new UploadStore()
    }

    if (options?.deployStore instanceof DeployStore) {
      this.deployStore = options.deployStore
    } else if (typeof options?.deployStore === 'string') {
      this.deployStore = new FSDeployStore(options.deployStore)
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
      const agent = this.config.getAgent()
      const chain = agent.chain
      this.log.info('Project name:           ', bold(this.name))
      this.log.info('Project root:           ', bold(this.root.path))
      this.log.info('Optimized contracts at: ', bold(this.dirs.wasm.shortPath))
      this.log.info('Contract checksums at:  ', bold(this.dirs.wasm.shortPath))
      const templates = Object.entries(this.templates??{})
      if (templates.length > 0) {
        this.log.info('ContractUploads in project:')
        for (const [name, {repository,revision,workspace,crate,features}] of templates) {
          this.log.info('-', name)//, repository, revision, workspace, crate, features)
        }
      } else {
        this.log.info('ContractUploads in project:   (none)')
      }
      this.log.br()
      this.log.info('Chain type:    ', bold(chain?.constructor.name))
      this.log.info('Chain mode:    ', bold(chain?.mode))
      this.log.info('Chain ID:      ', bold(chain?.id))
      if (!chain?.isMocknet) {
        this.log.info('Chain URL:     ', bold(chain?.url.toString()))
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
      return await this.builder.buildMany(sources)
    })

  rebuild = this.command(
    'rebuild', 'rebuild the project or specific contracts from it',
    (...names: string[]): Promise<CompiledCode[]> => {
      this.builder.caching = false
      return this.build(...names)
    })

  /** Upload one or more named templates, or all templates if no arguments are passed.
    * Build templates with missing artifacts if sources are available. */
  upload = this.command(
    'upload', 'upload the project or specific contracts from it',
    async (...names: string[]): Promise<ContractUpload[]> => {
      let sources: Partial<CompiledCode>[] = await this.getSources(names)
      if (this.builder) sources = await this.builder.buildMany(sources)
      const options = { uploadStore: this.uploadStore, reupload: false }
      return Object.values(await this.config.getAgent().uploadMany(sources, options))
    })

  reupload = this.command(
    'reupload', 'reupload the project or specific contracts from it',
    async (...names: string[]): Promise<ContractUpload[]> => {
      let sources: Partial<CompiledCode>[] = await this.getSources(names)
      if (this.builder) sources = await this.builder.buildMany(sources)
      const options = { uploadStore: this.uploadStore, reupload: true }
      return Object.values(await this.config.getAgent().uploadMany(sources, options))
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
    }) as ContractUpload[]
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
      const agent = this.config.getAgent()
      await deployment.deploy({ agent })
      await this.log.deployment(deployment)
      if (!agent.chain!.isMocknet) {
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
      if (!deployment) throw new Error.Missing.Deployment()
      if (!path) path = process.cwd()
      // If passed a directory, generate file name
      let file = $(path)
      if (file.isDirectory()) file = file.in(`${name}_@_${timestamp()}.json`)
      // Serialize and write the deployment.
      file.as(JSONFile).makeParent().save(deployment.toReceipt())
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
    templates: Record<string, Partial<ContractUpload>> = {},
    contracts: Record<string, Partial<ContractInstance>> = {},
  ): InstanceType<typeof this.Deployment> {
    if (!name) {
      throw new Error.Missing.Name()
    }
    if (this.deployStore.has(name)) {
      return this.deployStore.get(name)!
    } else {
      throw new Error.Missing.Deployment()
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
    const crates: Record<string, ContractCrate> = {}
    for (const [name, template] of Object.entries(this.templates)) {
      if (template.crate) crates[name] = new ContractCrate(this, template.crate)
    }
    return crates
  }

  getTemplate (name: string): ContractUpload {
    return this.templates[name] as ContractUpload
  }

  setTemplate (
    name: string, value: string|Partial<ContractUpload>
  ): ContractUpload {
    const defaults = { workspace: this.root.path, revision: 'HEAD' }
    return this.templates[name] =
      (typeof value === 'string') ? new ContractUpload({ ...defaults, crate: value }) :
      (value instanceof ContractUpload) ? value : new ContractUpload({ ...defaults, ...value })
  }

  /** @returns Boolean whether the project (as defined by fadroma.yml in root) exists */
  exists () {
    return this.files.fadromaYaml.exists()
  }

  listDeployments () {
    return this.log.deploy.deploymentList(this.config.chainId??'(unspecified)', this.deployStore)
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
