import { Config, Console, colors, Error, DeployError } from './util'
import { getBuilder } from './build'
import { getUploader } from './upload'

import type {
  Builder, Buildable, Built, Uploader, Chain,
  CodeId, CodeHash, ChainId, Uploadable, Uploaded,
  DeploymentClass,
} from '@fadroma/agent'
import {
  Deployment, DeployStore,
  Agent, AnyContract, Contract, Client, DeploymentState, Template,
  toInstanceReceipt, timestamp, bold
} from '@fadroma/agent'

import { CommandContext } from '@hackbg/cmds'
import $, {
  Path, YAMLDirectory, YAMLFile, TextFile, alignYAML, OpaqueDirectory,
  OpaqueFile, TOMLFile, JSONFile, JSONDirectory
} from '@hackbg/file'

import YAML, { loadAll, dump } from 'js-yaml'
import Case from 'case'
import prompts from 'prompts'

import { basename } from 'node:path'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

//@ts-ignore
export const { version } = $(import.meta.url, '../package.json').as(JSONFile).load() as any

const console = new Console(`@hackbg/fadroma ${version}`)

export class Project extends CommandContext {
  log = new Console(`Fadroma ${version}`) as any
  /** Fadroma settings. */
  config:    Config
  /** Name of the project. */
  name:      string
  /** Root directory of the project. */
  root:      OpaqueDirectory
  /** Contract definitions. */
  templates: Record<string, Template<any>>
  /** Default builder. */
  builder:   Builder
  /** Default uploader. */
  uploader:  Uploader
  /** Default deployment class. */
  Deployment = Deployment

  static wizard = (...args: any[]) => new ProjectWizard().createProject(...args)

  static load = (path: string|OpaqueDirectory = process.cwd()): Project|null => {
    const configFile = $(path, 'fadroma.json').as(JSONFile)
    if (configFile.exists()) {
      return new Project(configFile.load() as Partial<Project>)
    } else {
      return null
    }
  }

  constructor (options?: Partial<Project & {
    templates: Record<string, Template<any>|(Buildable & Partial<Built>)>
  }>) {
    super()

    // Configure
    this.config = options?.config ?? new Config()
    const root = $(options?.root || process.cwd()).as(OpaqueDirectory)
    const name = options?.name || root.name
    this.name = name
    this.root = root
    this.log.label = this.exists() ? name : `@hackbg/fadroma ${version}`
    if (this.exists()) this.log.info(`Active project:`, bold(this.name), 'at', bold(this.root.path))
    if (this.exists()) this.log.info(`Selected chain:`, bold(this.config.chainId))
    this.builder = getBuilder({ outputDir: this.dirs.wasm.path })
    const uploadState = this.config.chainId ? this.dirs.state.in(this.config.chainId).path : null
    this.uploader = getUploader({ uploadState })

    // Populate templates
    this.templates = {}
    const templates = options?.templates || (this.exists()
      ? ((this.files.fadromaJson.load()||{}) as any).templates||{}
      : {}) as Record<string, Template<any>|(Buildable & Partial<Built>)>
    for (const [key, val] of Object.entries(templates)) this.setTemplate(key, val)

    this.command('run',      'execute a script',
                 this.runScript)
    this.command('status',   'show the status of the system',
                 this.status)
    this.command('create',   'create a new project',
                 Project.wizard)
    this.command('add',      'add a new contract crate to the project',
                 this.addCrate)
    this.command('build',    'build the project or specific contracts from it',
                 this.build)
    this.command('upload',   'upload the project or specific contracts from it',
                 this.upload)
    this.command('deploy',   'deploy this project or continue an interrupted deployment',
                 this.deploy)
    this.command('redeploy', 'deploy this project from scratch',
                 this.redeploy)
    this.command('select',   `activate another deployment on ${this.config.chainId}`,
                 this.selectDeployment)
    this.command('export',   `export current deployment to ${name}.json`,
                 this.exportDeployment)
    this.command('reset',    'stop and erase running devnet',
                 this.resetDevnet)
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
      fadromaJson:    this.root.at('fadroma.json').as(JSONFile),
      githubWorkflow: null,
      gitignore:      this.root.at('.gitignore').as(TextFile),
      packageJson:    this.root.at('package.json').as(JSONFile),
      apiIndex:       this.root.at('api.ts').as(TextFile),
      opsIndex:       this.root.at('ops.ts').as(TextFile),
      readme:         this.root.at('README.md').as(TextFile),
      shellNix:       this.root.at('shell.nix').as(TextFile),
    }
  }
  /** @returns stateless handles for the contract crates
    * corresponding to templates in fadroma.json */
  get crates () {
    const crates: Record<string, ContractCrate> = {}
    for (const [name, template] of Object.entries(this.templates)) {
      if (template.crate) crates[name] = new ContractCrate(this, template.crate)
    }
    return crates
  }
  /** @returns the active deployment */
  get deployment () {
    return this.getDeployment()
  }
  /** @returns an up-to-date DeployStore */
  get deployStore () {
    return this.config.getDeployStore()
  }

  runShellCommands = (...cmds: string[]) =>
    cmds.map(cmd=>execSync(cmd, { cwd: this.root.path, stdio: 'inherit' }))
  runScript = (script?: string, ...args: string[]) => {
    if (!script)
      throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
    if (!$(script).exists())
      throw new Error(`${script} doesn't exist`)
    this.log.log(`Running ${script}`)
    //@ts-ignore
    return import($(script).path).then(script=>{
      if (typeof script.default === 'function') {
        return script.default(this, ...args)
      } else {
        this.log.info(`${$(script).shortPath} does not have a default export.`)
      }
    })
  }
  addCrate = () => {
    throw new Error('unimplemented')
  }
  getTemplate = (name: string): (Template<any> & Buildable)|undefined =>
    this.templates[name] as Template<any> & Buildable
  setTemplate = (
    name: string, value: string|Template<any>|(Buildable & Partial<Built>)
  ): Template<any> => {
    const defaults = { workspace: this.root.path, revision: 'HEAD' }
    return this.templates[name] =
      (typeof value === 'string') ? new Template({ ...defaults, crate: value }) :
      (value instanceof Template) ? value : new Template({ ...defaults, ...value })
  }
  /** Print the current status of Fadroma, the active devnet, project, and deployment.
    * @returns this */
  status = () => {
    tools()
    const chain = this.uploader?.agent?.chain ?? this.config.getChain()
    const agent = this.uploader?.agent ?? chain?.getAgent()
    this.log.br()
    this.log.info('Project name:           ', bold(this.name))
    this.log.info('Project root:           ', bold(this.root.path))
    this.log.info('Optimized contracts at: ', bold(this.dirs.wasm.shortPath))
    this.log.info('Contract checksums at:  ', bold(this.dirs.wasm.shortPath))
    const templates = Object.entries(this.templates??{})
    if (templates.length > 0) {
      this.log.info('Templates in project:')
      for (const [name, {repository,revision,workspace,crate,features}] of templates) {
        this.log.info('-', name)//, repository, revision, workspace, crate, features)
      }
    } else {
      this.log.info('Templates in project:   (none)')
    }
    this.log.br()
    this.log.info('Chain type:    ', bold(chain.constructor.name))
    this.log.info('Chain mode:    ', bold(chain.mode))
    this.log.info('Chain ID:      ', bold(chain.id))
    if (!chain.isMocknet) {
      this.log.info('Chain URL:     ', bold(chain.url.toString()))
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
      const deployment = this.deployment
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
  }
  /** Write the files representing the described project to the root directory.
    * @returns this */
  create = () => {
    const { name, templates, root, dirs, files, crates } = this
    root.make()
    Object.values(this.dirs).forEach(dir=>dir.make())
    const {
      readme, fadromaJson, packageJson, apiIndex, opsIndex, gitignore, envfile, shellNix, cargoToml
    } = files
    readme.save([
      `# ${name}\n---\n`,
      `Powered by [Fadroma](https://fadroma.tech) `,
      `by [Hack.bg](https://hack.bg) `,
      `under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
    ].join(''))
    fadromaJson.save({ templates })
    packageJson.save({
      name: `${name}`,
      main: `api.ts`,
      type: "module",
      version: "0.1.0",
      dependencies: {
        "@fadroma/agent": "latest",
        "@fadroma/scrt": "latest",
      },
      devDependencies: {
        "@hackbg/fadroma": "latest",
        "@hackbg/ganesha": "latest",
        "typescript": "^5",
      },
      scripts: {
        "build":   "fadroma build",
        "status":  "fadroma status",
        "mocknet": `FADROMA_OPS=./ops.ts FADROMA_CHAIN=Mocknet fadroma`,
        "devnet":  `FADROMA_OPS=./ops.ts FADROMA_CHAIN=ScrtDevnet fadroma`,
        "testnet": `FADROMA_OPS=./ops.ts FADROMA_CHAIN=ScrtTestnet fadroma`,
        "mainnet": `FADROMA_OPS=./ops.ts FADROMA_CHAIN=ScrtMainnet fadroma`,
      },
    })
    apiIndex.save([
      `import { Client, Deployment } from '@fadroma/agent'`,
      [
        `export default class ${Case.pascal(name)} extends Deployment {`,
        ...Object.keys(templates).map(name => [
          `  ${name} = this.contract({`,
          `    name: "${name}",`,
          `    crate: "${name}",`,
          `    client: ${Case.pascal(name)},`,
          `    initMsg: async () => ({})`,
          `  })`
        ].join('\n')),
        '',
        `  // Add contract with::`,
        `  //   contract = this.contract({...})`, `  //`,
        `  // Add contract from fadroma.json with:`,
        `  //   contract = this.template('name').instance({...})`,
        '',
        '}',
      ].join('\n'),
      ...Object.keys(templates).map(Case.pascal).map(Contract => [
        `export class ${Contract} extends Client {`,
        `  // Implement methods calling the contract here:`, `  //`,
        `  // async myTx (arg1, arg2) {`,
        `  //   return await this.execute({ my_tx: { arg1, arg2 }})`,
        `  // }`,
        `  // async myQuery (arg1, arg2) {`,
        `  //   return await this.query({ my_query: { arg1, arg2 } })`,
        `  // }`, `  //`,
        `  // or like this:`, `  //`,
        `  // myTx = (arg1, arg2) => this.execute({my_tx:{arg1, arg2}})`,
        `  // myQuery = (arg1, arg2) => this.query({my_query:{arg1, arg2}})`, `  //`,
        `}\n`
      ].join('\n'))
    ].join('\n\n'))
    opsIndex.save([
      [
        `import ${Case.pascal(name)} from './api'`,
        `import Project from '@hackbg/fadroma'`,
      ].join('\n'),
      [
        `export default class ${Case.pascal(name)}Project extends Project {`, ``,
        `  Deployment = ${Case.pascal(name)}`, ``,
        `  // Override to customize the build command:`, `  //`,
        `  // build = async (...contracts: string[]) => { `,
        `  //   await super.build(...contracts)`,
        `  // }`, ``,
        `  // Override to customize the upload command:`, `  //`,
        `  // upload = async (...contracts: string[]) => {`,
        `  //   await super.upload(...contracts)`,
        `  // }`, ``,
        `  // Override to customize the deploy command:`,
        `  //`,
        `  // deploy = async (...args: string[]) => {`,
        `  //   await super.deploy(...args)`,
        `  // }`, ``,
        `  // Override to customize the status command:`, `  //`,
        `  // status = async (...args: string[]) => {`,
        `  //   await super.status()`,
        `  // }`, ``,
        `  // Define custom commands using \`this.command\`:`, `  //`,
        `  // custom = this.command('custom', 'run a custom procedure', async () => {`,
        `  //   // ...`,
        `  // })`,
        ``, `}`
      ].join('\n')
    ].join('\n\n'))
    gitignore.save([
      '.env', 'node_modules', 'target', 'state/fadroma-devnet*', '*.wasm',
    ].join('\n'))
    envfile.save([
      '# FADROMA_MNEMONIC=your testnet mnemonic'
    ].join('\n'))
    shellNix.save([
      `{ pkgs ? import <nixpkgs> {}, ... }: let name = "${name}"; in pkgs.mkShell {`,
      `  inherit name;`,
      `  nativeBuildInputs = with pkgs; [`,
      `    git nodejs nodePackages_latest.pnpm rustup`,
      `    binaryen wabt wasm-pack wasm-bindgen-cli`,
      `  ];`,
      `  shellHook = ''`,
      `    export PS1="$PS1[\${name}] "`,
      `    export PATH="$PATH:$HOME/.cargo/bin:\${./.}/node_modules/.bin"`,
      `  '';`,
      `}`,
    ].join('\n'))
    cargoToml.as(TextFile).save([
      `[workspace]`, `resolver = "2"`, `members = [`,
      Object.values(this.crates).map(crate=>`  "src/${crate.name}"`).sort().join(',\n'),
      `]`
    ].join('\n'))
    const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    Object.values(crates).forEach(crate=>{
      crate.create()
      const name = `${crate.name}@HEAD.wasm`
      this.dirs.wasm.at(`${name}.sha256`).as(TextFile).save(`${sha256}  *${name}`)
    })
    this.log("created at", this.root.shortPath)
    return this
  }

  /** Create a Git repository in the project directory and make an initial commit.
    * @returns this */
  gitSetup = () => {
    this.runShellCommands(
      'git --no-pager init',
      'git --no-pager add .',
      'git --no-pager status',
      'git --no-pager commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git --no-pager log",
    )
    return this
  }

  gitCommit = (message: string = "") => {
    this.runShellCommands(
      'git --no-pager add .',
      'git --no-pager status',
      `git --no-pager commit -m ${message}`,
    )
  }

  /** @returns this */
  npmInstall = ({ npm, yarn, pnpm }: any = tools()) => {
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
  cargoUpdate = () => {
    this.runShellCommands('cargo update')
    return this
  }

  /** @returns Boolean whether the project (as defined by fadroma.json in root) exists */
  exists = () =>
    this.files.fadromaJson.exists()
  /** Builds one or more named templates, or all templates if no arguments are passed. */
  build = async (...names: string[]): Promise<Built[]> => {
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
    return await this.builder.buildMany(sources as (Template<any> & Buildable)[])
  }
  /** Uploads one or more named templates, or all templates if no arguments are passed.
    * Builds templates with missing artifacts if sources are available. */
  upload = async (...names: string[]): Promise<Uploaded[]> => {
    if (names.length < 1) {
      names = Object.keys(this.templates)
      if (names.length > 0) {
        this.log.log('Uploading all:', names.join(', '))
        return await this.upload(...names)
      }
      this.log.warn('This would upload all contracts, but no contracts are defined.')
      return []
    }
    const sources = names.map(name=>this.getTemplate(name)).filter((template, i)=>{
      if (!template) this.log.warn(`No such template in project: ${names[i]}`)
      return !!template
    }) as (Template<any> & Buildable & Partial<Built>)[]
    if (sources.length < 1) {
      this.log.warn('Nothing to upload.')
      return []
    }
    // Build templates if builder is available
    const templates = this.builder
      ? await this.builder.buildMany(sources)
      : sources
    return await this.uploader.uploadMany(
      templates as (Template<any> & Buildable & Built & Uploadable)[]
    )
  }
  deploy = async (...args: string[]) => {
    const deployment = this.deployment
    if (!deployment) throw new Error.NoDeployment()
    this.log(`Active deployment is:`, bold(deployment.name), `(${deployment.constructor?.name})`)
    await deployment.deploy()
    await this.log.deployment(deployment)
    if (!deployment.chain!.isMocknet) await this.selectDeployment(deployment.name)
    return deployment
  }
  redeploy = async (...args: string[]) => {
    await this.createDeployment()
    return await this.deploy(...args)
  }
  /** Get the active deployment or a named deployment.
    * @returns Deployment|null */
  getDeployment = (name?: string): InstanceType<typeof this.Deployment>|null => {
    return this.config.getDeployment(this.Deployment, {
      agent:     this.uploader.agent ??= this.config.getAgent(),
      chain:     this.uploader.agent.chain,
      builder:   this.builder,
      uploader:  this.uploader,
      workspace: this.root.path,
      store:     this.deployStore
    })
  }
  listDeployments = () =>
    this.log.deploy.deploymentList(
      this.config.chainId??'(unspecified)',
      this.config.getDeployStore()
    )
  createDeployment = (name: string = timestamp()) =>
    this.config.getDeployStore().create(name)
      .then(()=>this.selectDeployment(name))
  selectDeployment = async (name?: string): Promise<DeploymentState|null> => {
    const store = this.deployStore
    const list = store.list()
    if (list.length < 1) throw new Error('No deployments in this store')
    let deployment
    if (name) {
      deployment = await store.select(name)
    } else if (process.stdout.isTTY) {
      name = await ProjectWizard.selectDeploymentFromStore(store)
      if (name) {
        return await store.select(name)
      } else {
        return null
      }
    } else if (store.active) {
      deployment = store.active
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
    return deployment || null
  }
  exportDeployment = async (path?: string) => {
    const store = this.deployStore
    const name  = this.deployStore.activeName
    if (!name) throw new Error.Deploy.NoDeployment()
    const state = store.load(name)
    if (!state) throw new Error.Deploy.NoDeployment()
    const deployment = this.deployment
    if (!deployment) throw new Error.Deploy.NoDeployment()
    const jsonFile = `${name}_@_${timestamp()}.json`
    this.log.log(`Exporting deployment`, deployment.name, 'to', jsonFile)
    this.log.deployment(deployment)
    for (const [name, contract] of Object.entries(deployment.state)) {
      state[name] = {
        ...contract,
        context:  undefined,
        builder:  undefined,
        uploader: undefined,
        agent:    undefined
      }
    }
    const file = $(path??(deployment?.store as any)?.root?.path??'')
      .at(jsonFile)
      .as(JSONFile)
    file.save(state)
    this.log.info(
      'Wrote', Object.keys(state).length,
      'contracts to', bold(file.shortPath)
    )
  }
  resetDevnet = async () => {
    const chain = this.uploader?.agent?.chain ?? this.config.getChain()
    if (!chain) {
      this.log.info('No active chain.')
    } else if (!chain.isDevnet || !chain.devnet) {
      this.log.error('This command is only valid for devnets.')
    } else {
      await chain.devnet.terminate()
    }
  }

}

export class ContractCrate {
  constructor (
    readonly project: Project,
    /** Name of crate */
    readonly name: string,
    /** Features of the 'fadroma' dependency to enable. */
    readonly fadromaFeatures: string[] = [ 'scrt' ],
    /** Root directory of crate. */
    readonly dir: OpaqueDirectory = project.dirs.src.in(name).as(OpaqueDirectory),
    /** Crate manifest. */
    readonly cargoToml: TextFile = dir.at('Cargo.toml').as(TextFile),
    /** Directory containing crate sources. */
    readonly src: OpaqueDirectory = dir.in('src').as(OpaqueDirectory),
    /** Root module of Rust crate. */
    readonly libRs: TextFile = src.at('lib.rs').as(TextFile)
  ) {}
  create () {
    console.log('Creating crate:', this.name)
    this.cargoToml.save([
      `[package]`,
      `name = "${this.name}"`,
      `version = "0.0.0"`,
      `edition = "2021"`,
      `authors = []`,
      `keywords = ["fadroma"]`,
      `description = ""`,
      `readme = "README.md"`, ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { git = "https://github.com/hackbg/fadroma", branch = "master", features = ${JSON.stringify(this.fadromaFeatures)} }`,
      `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
    ].join('\n'))
    this.src.make()
    this.libRs.save([
      `//! Created by [Fadroma](https://fadroma.tech).`, ``,
      `#[fadroma::dsl::contract] pub mod contract {`,
      `    use fadroma::{*, dsl::*, prelude::*};`,
      `    impl Contract {`,
      `        #[init(entry)]`,
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

export default Project

/** Interactive project creation CLI.
  * TODO: single crate option
  * TODO: `shared` crate option */
export class ProjectWizard {
  async createProject (...args: any[]): Promise<Project> {
    const context = tools()
    let { ttyIn, ttyOut, git, pnpm, yarn, npm, cargo, docker, podman } = context
    const tty = ttyIn && ttyOut
    const name = tty ? await this.askName() : args[0]
    const root = (tty ? $(await this.askRoot(name)) : $(name)).as(OpaqueDirectory)
    const templates = tty ? await this.askTemplates(name) : args.slice(1)
    const project = new Project({ name, root, templates: templates as any })
    await project.create()
    if (tty) {
      switch (await this.selectBuilder(context)) {
        case 'podman': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_PODMAN=1`); break
        case 'raw': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_RAW=1`); break
        default:
      }
    }
    let changed = false
    let nonfatal = false
    if (git) {
      try {
        project.gitSetup()
      } catch (e) {
        console.warn('Non-fatal: Failed to create Git repo.')
        nonfatal = true
        git = null
      }
    } else {
      console.warn('Git not found. Not creating repo.')
    }
    if (pnpm || yarn || npm) {
      try {
        project.npmInstall(context)
        changed = true
      } catch (e) {
        console.warn('Non-fatal: NPM install failed:', e)
        nonfatal = true
      }
    } else {
      console.warn('NPM/Yarn/PNPM not found. Not creating lockfile.')
    }
    if (cargo) {
      try {
        project.cargoUpdate()
        changed = true
      } catch (e) {
        console.warn('Non-fatal: Cargo update failed:', e)
        nonfatal = true
      }
    } else {
      console.warn('Cargo not found. Not creating lockfile.')
    }
    if (changed && git) {
      try {
        project.gitCommit('"Updated lockfiles."')
      } catch (e) {
        console.warn('Non-fatal: Git status failed:', e)
        nonfatal = true
      }
    }
    if (nonfatal) {
      console.warn('One or more convenience operations failed.')
      console.warn('You can retry them manually later.')
    }
    console.log("Project created at", bold(project.root.shortPath))
    console.info()
    console.info(`To compile your contracts:`)
    console.info(`  $ npm run build`)
    console.info()
    console.info(`To spin up a local deployment:`)
    console.info(`  $ npm run devnet deploy`)
    console.info()
    //console.info(`View documentation at ${root.in('target').in('doc').in(name).at('index.html').url}`)
    return project
  }
  async askName (): Promise<string> {
    let value
    while ((value = (await askText('Enter a project name (a-z, 0-9, dash/underscore)')??'').trim()) === '') {}
    return value
  }
  askRoot (name: string): Promise<Path> {
    const cwd = $(process.cwd())
    const exists = cwd.in(name).exists()
    const inSub = `Subdirectory (${exists?'overwrite: ':''}${cwd.name}/${name})`
    const inCwd = `Current directory (${cwd.name})`
    return askSelect(`Create project ${name} in current directory or subdirectory?`, [
      { title: inSub, value: cwd.in(name) },
      { title: inCwd, value: cwd },
    ])
  }
  askTemplates (name: string):
    Promise<Record<string, Template<any>|(Buildable & Partial<Built>)>>
  {
    return askUntilDone({}, (state) => askSelect([
      `Project ${name} contains ${Object.keys(state).length} contract(s):\n`,
      `  ${Object.keys(state).join(',\n  ')}\n`
    ].join(''), [
      { title: `Add contract template to the project`, value: defineContract },
      { title: `Remove contract template`, value: undefineContract },
      { title: `Rename contract template`, value: renameContract },
      { title: `(done)`, value: null },
    ]))
    async function defineContract (state: Record<string, any>) {
      const crate = await askText([
        'Enter a name for the new contract (lowercase a-z, 0-9, dash, underscore):',
      ].join('\n'))
      if (crate) {
        state[crate] = { crate }
      }
    }
    async function undefineContract (state: Record<string, any>) {
      const name = await askSelect(`Select contract to remove from project scope:`, [
        ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
        { title: `(done)`, value: null },
      ])
      delete state[name]
    }
    async function renameContract (state: Record<string, any>) {
      const contract = await askSelect(`Select contract to rename:`, [
        ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
        { title: `(done)`, value: null },
      ])
      const name = await askText(`Enter a new name for ${contract} (a-z, 0-9, dash/underscore):`)
      if (name) {
        state[name] = state[contract]
        delete state[contract]
      }
    }
  }
  selectBuilder (context: ReturnType<typeof tools>): 'podman'|'raw'|any {
    const { cargo = 'not installed', docker = 'not installed', podman = 'not installed' } = context
    const buildRaw    = { value: 'raw',    title: `No, build with local toolchain (${cargo})` }
    const buildDocker = { value: 'docker', title: `Yes, build in a Docker container (${docker})` }
    const buildPodman = { value: 'podman', title: `Yes, build in a Podman container (${podman})` }
    const hasPodman = context.podman && (context.podman !== 'not installed')
    const engines = hasPodman ? [ buildPodman, buildDocker ] : [ buildDocker, buildPodman ]
    const isLinux = platform() === 'linux'
    const choices = isLinux ? [ ...engines, buildRaw ] : [ buildRaw, ...engines ]
    return askSelect(`Use build isolation?`, choices)
  }
  static selectDeploymentFromStore = async (store: DeployStore & {
    root?: Path
  }): Promise<string|undefined> => {
    const label = store.root
      ? `Select a deployment from ${store.root.shortPath}:`
      : `Select a deployment:`
    return await askSelect(label, [
      ...store.list().map(title=>({ title, value: title })),
      { title: '(cancel)', value: undefined }
    ])
  }

}

export async function askText <T> (
  message: string,
  valid = (x: string) => clean(x).length > 0,
  clean = (x: string) => x.trim()
) {
  while (true) {
    const input = await prompts.prompt({ type: 'text', name: 'value', message })
    if ('value' in input) {
      if (valid(input.value)) return clean(input.value)
    } else {
      console.error('Input cancelled.')
      process.exit(1)
    }
  }
}

export async function askSelect <T> (message: string, choices: any[]) {
  const input = await prompts.prompt({ type: 'select', name: 'value', message, choices })
  if ('value' in input) return input.value
  console.error('Input cancelled.')
  process.exit(1)
}

export async function askUntilDone <S> (state: S, selector: (state: S)=>Promise<Function|null>|Function|null) {
  let action = null
  while (typeof (action = await Promise.resolve(selector(state))) === 'function') {
    await Promise.resolve(action(state))
  }
  return state
}

export const tools = () => {
  console.br()
  return {
    ttyIn:  check('TTY in:   ', !!process.stdin.isTTY),
    ttyOut: check('TTY out:  ', !!process.stdout.isTTY),
    //console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
    git:       tool('Git:      ', 'git --no-pager --version'),
    node:      tool('Node:     ', 'node --version'),
    npm:       tool('NPM:      ', 'npm --version'),
    yarn:      tool('Yarn:     ', 'yarn --version'),
    pnpm:      tool('PNPM:     ', 'pnpm --version'),
    tsc:       tool('TSC:      ', 'tsc --version'),
    cargo:     tool('Cargo:    ', 'cargo --version'),
    rust:      tool('Rust:     ', 'rustc --version'),
    docker:    tool('Docker:   ', 'docker --version'),
    podman:    tool('Podman:   ', 'podman --version'),
    nix:       tool('Nix:      ', 'nix --version'),
    secretcli: tool('secretcli:', 'secretcli version')
  }
}

/** Check a variable */
export const check = <T> (name: string|null, value: T): T => {
  if (name) console.info(bold(name), value)
  return value
}

/** Check if an external binary is on the PATH. */
export const tool = (dependency: string|null, command: string): string|null => {
  let version = null
  try {
    version = String(execSync(command)).trim()
    if (dependency) console.info(bold(dependency), version)
  } catch (e) {
    if (dependency) console.warn(bold(dependency), colors.yellow('(not found)'))
  } finally {
    return version
  }
}

export {
  DeployStore,
  YAML,
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class DeployStore_YAML1 extends DeployStore {
  log = new Console('DeployStore (YAML1)')
  /** Root directory of deploy store. */
  root: YAMLDirectory<unknown>
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
  ) {
    super()
    const root = this.root = $(storePath).as(YAMLDirectory)
    Object.defineProperty(this, 'root', {
      enumerable: true,
      get () { return root }
    })
  }

  get [Symbol.toStringTag]() { return `${this.root?.shortPath??'-'}` }

  /** Load the deployment activeted by symlink */
  get active () {
    return this.load(this.KEY)
  }
  get activeName (): string|null {
    let file = this.root.at(`${this.KEY}.yml`)
    if (!file.exists()) return null
    return basename(file.real.name, '.yml')
  }
  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()): Promise<DeploymentState> {
    this.log.deploy.creating(name)
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    this.log.deploy.location(path.shortPath)
    path.makeParent().as(YAMLFile).save(undefined)
    return this.load(name)!
  }
  /** Make the specified deployment be the active deployment. */
  async select (name: string = this.KEY): Promise<DeploymentState> {
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      if (name === this.KEY) name = active.real.name
      name = basename(name, '.yml')
      active.relLink(`${name}.yml`)
      this.log.deploy.activating(selected.real.name)
      return this.load(name)!
    }
    if (name === this.KEY) {
      const deployment = new Deployment()
      const d = await this.create(deployment.name)
      return this.select(deployment.name)
    }
    throw new DeployError.DeploymentDoesNotExist(name)
  }
  /** List the deployments in the deployments directory. */
  list (): string[] {
    if (this.root.exists()) {
      const list = this.root.as(OpaqueDirectory).list() ?? []
      return list.filter(x=>x.endsWith('.yml')).map(x=>basename(x, '.yml')).filter(x=>x!=this.KEY)
    } else {
      this.log.deploy.storeDoesNotExist(this.root.shortPath)
      return []
    }
  }
  /** Get the contents of the named deployment, or null if it doesn't exist. */
  load (name: string): DeploymentState|null {
    const file = this.root.at(`${name}.yml`)
    this.log.log('Loading deployment', name, 'from', file.shortPath)
    if (!file.exists()) {
      this.log.error(`${file.shortPath} does not exist.`)
      return null
    }
    name = basename(file.real.name, '.yml')
    const state: DeploymentState = {}
    for (const receipt of file.as(YAMLFile).loadAll() as Partial<AnyContract>[]) {
      if (!receipt.name) continue
      state[receipt.name] = receipt
    }
    return state
  }
  /** Save a deployment's state to this store. */
  save (name: string, state: DeploymentState = {}) {
    this.root.make()
    const file = this.root.at(`${name}.yml`)
    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(state)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new Error('Deployment: no name')
      const receipt: any = toInstanceReceipt(new Contract(data as Partial<AnyContract>) as any)
      data = JSON.parse(JSON.stringify({
        name,
        label:    receipt.label,
        address:  receipt.address,
        codeHash: receipt.codeHash,
        codeId:   receipt.label,
        crate:    receipt.crate,
        revision: receipt.revision,
        ...receipt,
        deployment: undefined
      }))
      const daDump = dump(data, { noRefs: true })
      output += alignYAML(daDump)
    }
    file.as(TextFile).save(output)
    return this
  }

}

Object.assign(DeployStore.variants, { YAML1: DeployStore_YAML1 })
