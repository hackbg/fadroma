import { getBuilder } from './build/index'
import { getUploader } from './upload/index'
import type {
  Builder, Buildable, Built, Uploader, Uploadable, Uploaded,
  Chain, ChainId, DeploymentState, DeployStore
} from '@fadroma/agent'
import { Template, Deployment } from '@fadroma/agent'
import $, { Path, OpaqueDirectory, OpaqueFile, JSONFile, TOMLFile, TextFile } from '@hackbg/file'
import { CommandContext } from '@hackbg/cmds'
import Console, { bold, colors } from './OpsConsole'
import Error from './OpsError'
import Config from './OpsConfig'
import Case from 'case'
import prompts from 'prompts'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

//@ts-ignore
export const { version } = $(import.meta.url, '../package.json').as(JSONFile).load() as any

const console = new Console(`@fadroma/ops ${version}`)

export default class Project extends CommandContext {
  log = new Console(`Fadroma ${version}`) as any
  /** Fadroma settings. */
  config: Config
  /** Name of the project. */
  name: string
  /** Root directory of the project. */
  root: OpaqueDirectory
  /** Contract definitions. */
  templates: Record<string, Template<any>>
  /** Default builder. */
  builder: Builder
  /** Default uploader. */
  uploader: Uploader
  /** Default deployment class. */
  Deployment = Deployment

  static wizard = () => new ProjectWizard().createProject()

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
    this.log.label = this.exists() ? `Project: ${name}` : `Fadroma ${version}`
    this.log.info(`This is @fadroma/ops ${version}.`)
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

    // Define commands:
    this.command('run',    'execute a script',
                 this.runScript)
    this.command('status', 'show the status of the system',
                 this.status)
    this.command('create', 'create a new project',
                 Project.wizard)
    this.command('add',    'add a new contract to the project',
                 this.addTemplate)
    this.command('build',  'build the project or specific contracts from it',
                 this.build)
    this.command('upload', 'upload the project or specific contracts from it',
                 this.upload)
    this.command('deploy', 'deploy this project',
                 this.deploy)
    this.command('select', `activate another deployment on ${this.config.chainId}`,
                 this.selectDeployment)
    this.command('export', `export current deployment to ${name}.json`,
                 this.exportDeployment)
    this.command('reset',  'stop and erase running devnet',
                 this.resetDevnet)
    const deployment = this.getDeployment()
    if (deployment) {
      this.commands('deployment', 'manage deployments of current project',
        {} as CommandContext)
      this.commands('contracts', 'manage contracts in current deployment',
        {} as CommandContext)
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
  addTemplate = () => {
    throw new Error('unimplemented')
  }
  getTemplate = (name: string): (Template<any> & Buildable)|undefined =>
    this.templates[name] as Template<any> & Buildable
  setTemplate = (
    name: string, value: string|Template<any>|(Buildable & Partial<Built>)
  ): Template<any> => {
    const defaults = { workspace: ".", revision: 'HEAD' }
    return this.templates[name] =
      (typeof value === 'string') ? new Template({ ...defaults, crate: value }) :
      (value instanceof Template) ? value : new Template({ ...defaults, ...value })
  }
  /** Print the current status of Fadroma, the active devnet, project, and deployment.
    * @returns this */
  status = () => {
    const chain = this.uploader?.agent?.chain ?? this.config.getChain()
    if (!chain) {
      this.log.info('No chain selected.')
    } else {
      this.log.info('Chain type:             ', bold(chain.constructor.name))
      this.log.info('Chain mode:             ', bold(chain.mode))
      this.log.info('Chain ID:               ', bold(chain.id))
      this.log.info('Chain URL:              ', bold(chain.url.toString()))
    }
    if (this.files.fadromaJson.exists()) {
      this.log.info('Project name:           ', bold(this.name))
      this.log.info('Project root:           ', bold(this.root.path))
      this.log.info('Templates in project:   ', bold(Object.keys(this.templates).join(', ')))
      this.log.info('Optimized contracts at: ', bold(this.dirs.wasm.shortPath))
      this.log.info('Contract checksums at:  ', bold(this.dirs.wasm.shortPath))
      this.log.info('Chain-specific state at:', bold(this.dirs.state.shortPath))
      if (this.dirs.state.exists()) {
        const states = this.dirs.state.list()
        if (states && states.length > 0) {
          this.log.info('Has state for chains:     ', bold(this.dirs.state.list()?.join(', ')))
        } else {
          this.log.info('No transactions recorded.')
        }
        const deployment = this.getDeployment()
        if (deployment) {
          this.log.info(deployment)
        } else {
          this.log.info('No active deployment.')
        }
      }
    } else {
      this.log.info('No active project.')
    }
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
        "dotenv": "^16.0.3",
        "typescript": "^5",
      },
      scripts: {
        "build":   "fadroma build",
        "status":  "fadroma status",
        "mocknet": `FADROMA_OPS=./ops.ts FADROMA_CHAIN=Mocknet_CW1 fadroma`,
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
  getBuildState = () => [
    ...this.dirs.wasm.list()?.filter(x=>x.endsWith('.wasm'))        ?? [],
    ...this.dirs.wasm.list()?.filter(x=>x.endsWith('.wasm.sha256')) ?? [],
  ]
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
  getUploadState = (chainId: ChainId|null = this.config.chainId) =>
    chainId ? this.dirs.state.in(chainId).in('upload').as(OpaqueDirectory).list() : {}
  deploy = async (...args: string[]) => {
    const deployment = await this.getDeployment()
    if (deployment) {
      this.log(`Active deployment is:`, bold(deployment.name), `(${deployment.constructor?.name})`)
      await deployment.deploy()
    } else {
      this
    }
  }
  getDeployState = (chainId: ChainId|null = this.config.chainId) =>
    chainId ? this.dirs.state.in(chainId).in('deploy').as(OpaqueDirectory).list() : {}
  /** Get the active deployment or a named deployment.
    * @returns Deployment|null */
  getDeployment = (name?: string): Deployment|null => {
    const store = this.config.getDeployStore()
    return this.config.getDeployment(this.Deployment, {
      agent:     this.uploader.agent ??= this.config.getAgent(),
      chain:     this.uploader.agent.chain,
      builder:   this.builder,
      uploader:  this.uploader,
      workspace: this.root.path
    })
  }
  listDeployments = () =>
    this.log.deploy.deploymentList(
      this.config.chainId??'(unspecified)',
      this.config.getDeployStore()
    )
  createDeployment = (name: string) =>
    this.config.getDeployStore().create(name).then(()=>this.selectDeployment(name))
  selectDeployment = async (name?: string): Promise<DeploymentState|null> => {
    const store = this.config.getDeployStore()
    const list = store.list()
    if (list.length < 1) throw new Error('No deployments in this store')
    let deployment
    if (name) {
      deployment = await store.select(name)
    } else if (store.active) {
      deployment = store.active
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
    return deployment || null
  }
  exportDeployment = async (path?: string) => {
    const store = this.config.getDeployStore()
    const deployment = store.active
    if (!deployment) throw new Error.Deploy.NoDeployment()
    const state: Record<string, any> = JSON.parse(JSON.stringify(deployment.state))
    for (const [name, contract] of Object.entries(state)) {
      delete contract.workspace
      delete contract.artifact
      delete contract.log
      delete contract.initMsg
      delete contract.builderId
      delete contract.uploaderId
    }
    const file = $(path??'').at(`${deployment.name}.json`).as(JSONFile)
    file.save(state)
    this.log.info('Wrote', Object.keys(state).length, 'contracts to', bold(file.shortPath))
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
      `readme = "README.md"`,
      ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { git = "https://github.com/hackbg/fadroma", branch = "feat/podman-nix", features = ${JSON.stringify(this.fadromaFeatures)} }`,
      `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
    ].join('\n'))
    this.src.make()
    this.libRs.save([
      `//! Created by [Fadroma](https://fadroma.tech).`, ``,
      `fadroma::contract! {`, '',
      `    #[init(entry)]`,
      `    pub fn new () -> Result<Response, StdError> {`,
      `        Ok(Response::default())`,
      `    }`,
      `    // #[execute]`,
      `    // pub fn my_tx_1 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `    //     Ok(Response::default())`,
      `    // }`,
      `    // #[execute]`,
      `    // pub fn my_tx_2 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `    //     Ok(Response::default())`,
      `    // }`,
      `    // #[query]`,
      `    // pub fn my_query_1 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `    //     Ok(())`, '',
      `    // }`,
      `    // #[query]`,
      `    // pub fn my_query_2 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `    //     Ok(())`, '',
      `    // }`,
      `}`,
    ].join('\n'))
  }
}

export class ProjectWizard {
  async createProject (): Promise<Project> {
    const context = tools()
    let { git, pnpm, yarn, npm, cargo, docker, podman } = context
    const name = await this.askName()
    const root = $(await this.askRoot(name)).as(OpaqueDirectory)
    const templates = await this.askTemplates(name)
    // TODO: ask/autodetect: build (docker/podman/raw), devnet (docker/podman)
    const project = new Project({ name, root, templates: templates as any })
    await project.create()
    switch (await this.askBuilder(context)) {
      case 'podman': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_PODMAN=1`); break
      case 'raw': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_RAW=1`); break
      default:
    }
    let changed = false
    let nonfatal = false
    if (git) {
      try {
        project.runShellCommands(
          'git --no-pager init',
          'git --no-pager add .',
          'git --no-pager status',
          'git --no-pager commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
          "git --no-pager log",
        )
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
        if (pnpm) {
          project.runShellCommands('pnpm i')
        } else if (yarn) {
          project.runShellCommands('yarn')
        } else {
          project.runShellCommands('npm i')
        }
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
        project.runShellCommands('cargo update')
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
        project.runShellCommands(
          'git --no-pager add .',
          'git --no-pager status',
          'git --no-pager commit -m "Updated lockfiles."',
        )
      } catch (e) {
        console.warn('Non-fatal: Git status failed:', e)
        nonfatal = true
      }
    }
    if (nonfatal) {
      console.warn('One or more convenience operations failed.')
      console.warn('You can retry them manually later.')
    }
    console.log("Done!")
    console.info()
    console.info(`To build your code:`)
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
  askBuilder (context: ReturnType<typeof tools>): 'podman'|'raw'|any {
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

export const tools = () => ({
  //console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  git:    tool('Git:    ', 'git --no-pager --version'),
  node:   tool('Node:   ', 'node --version'),
  npm:    tool('NPM:    ', 'npm --version'),
  yarn:   tool('Yarn:   ', 'yarn --version'),
  pnpm:   tool('PNPM:   ', 'pnpm --version'),
  tsc:    tool('TSC:    ', 'tsc --version'),
  cargo:  tool('Cargo:  ', 'cargo --version'),
  rust:   tool('Rust:   ', 'rustc --version'),
  docker: tool('Docker: ', 'docker --version'),
  podman: tool('Podman: ', 'podman --version'),
  nix:    tool('Nix:    ', 'nix --version'),
})

export const tool = (dependency: string, command: string): string|null => {
  let version = null
  try {
    version = String(execSync(command)).trim()
    console.log(bold(dependency), version)
  } catch (e) {
    console.warn(bold(dependency), colors.yellow('(not found)'))
  } finally {
    return version
  }
}
