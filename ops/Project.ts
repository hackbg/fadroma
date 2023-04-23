import { getBuilder } from './build/index'
import { getUploader } from './upload/index'

import type { Builder, Buildable, Built, Uploader, Uploadable, Uploaded } from '@fadroma/agent'
import { Template } from '@fadroma/agent'

import Case from 'case'
import prompts from 'prompts'

import { execSync } from 'node:child_process'
import $, { Path, OpaqueDirectory, OpaqueFile, JSONFile, TOMLFile, TextFile } from '@hackbg/file'

import Console, { bold, colors } from './OpsConsole'
import Error from './OpsError'
import Config from './OpsConfig'

import type { Chain, ChainId, DeploymentState, DeployStore } from '@fadroma/agent'
import { Deployment } from '@fadroma/agent'

import { CommandContext } from '@hackbg/cmds'

const console = new Console('@fadroma/project')

export default class Project extends CommandContext {
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

  constructor (options?: Partial<Project & {
    templates: Record<string, Template<any>|(Buildable & Partial<Built>)>
  }>) {
    super()
    // Define config, name and root directory
    this.config = options?.config ?? new Config()
    const root = $(options?.root || process.cwd()).as(OpaqueDirectory)
    const name = options?.name || root.name
    this.name = name
    this.root = root
    this.log.label = this.exists() ? `Project: ${name}` : `Fadroma ${version}`
    this.log.info(`This is @fadroma/ops ${version}.`)
    if (this.exists()) this.log.info(`Active project:`, bold(this.name), 'at', bold(this.root.path))
    if (this.exists()) this.log.info(`Selected chain:`, bold(this.config.chainId))
    this.builder = getBuilder({ outputDir: this.dirs.dist.path })
    const uploadState = this.config.chainId ? this.dirs.state.in(this.config.chainId).path : null
    this.uploader = getUploader({ uploadState })
    // Populate templates
    this.templates = {}
    const templates = options?.templates || (this.exists()
      ? ((this.files.fadromaJson.load()||{}) as any).templates||{}
      : {}) as Record<string, Template<any>|(Buildable & Partial<Built>)>
    for (const [key, val] of Object.entries(templates)) this.setTemplate(key, val)
    // Define commands:
    this.command('run', 'execute a script', this.runScript)
    this.command('status', 'show state of project', this.status)
    this.commands('devnet', 'manage local development containers',
      new DevnetCommands() as unknown as CommandContext)
    if (this.files.fadromaJson.exists()) {
      this.commands('template', 'manage contract templates in current project',
        new TemplateCommands(this) as unknown as CommandContext)
      this.command('build', 'build the project or specific contracts from it', this.build)
      this.command('upload', 'upload the project or specific contracts from it', this.upload)
      this.command('deploy', 'deploy this project', this.deploy)
      const deployment = this.getDeployment()
      if (deployment) {
        this.commands('deployment', 'manage deployments of current project',
          {} as CommandContext)
        this.commands('contracts', 'manage contracts in current deployment',
          {} as CommandContext)
      }
    } else {
      this.command('create', 'create a new project', Project.wizard)
    }
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
  getTemplate = (name: string): (Template<any> & Buildable)|undefined =>
    this.templates[name] as Template<any> & Buildable
  setTemplate = (
    name: string, value: string|Template<any>|(Buildable & Partial<Built>)
  ): Template<any> => {
    const defaults = { workspace: this.root.shortPath, revision: 'HEAD' }
    return this.templates[name] =
      (typeof value === 'string') ? new Template({ ...defaults, crate: value }) :
      (value instanceof Template) ? value : new Template({ ...defaults, ...value })
  }
  /** Print the current status of Fadroma, the active devnet, project, and deployment.
    * @returns this */
  status = () => {
    const chain = this.config.getChain()
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
      this.log.info('Optimized contracts at: ', bold(this.dirs.dist.shortPath))
      this.log.info('Contract checksums at:  ', bold(this.dirs.dist.shortPath))
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
    const { name, templates } = this
    this.root.make()
    this.files.readme.save([
      `# ${name}\n---\n`,
      `Made with [Fadroma](https://fadroma.tech)',
      'provided courtesy of [Hack.bg](https://hack.bg)',
      'under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
    ].join(''))
    this.files.gitignore.save([
      '.env', 'node_modules', 'target', 'state/fadroma-devnet*', 'dist', '!dist/*.sha256'
    ].join('\n'))
    this.files.envfile.save('# FADROMA_MNEMONIC=your testnet mnemonic')
    this.files.shellNix.save([
      `{ pkgs ? import <nixpkgs> {}, ... }: let name = "${name}"; in pkgs.mkShell {`,
      `  inherit name;`,
      `  nativeBuildInputs = with pkgs; [ git nodejs nodePackages_latest.pnpm rustup ];`,
      `  shellHook = ''`,
      `    export PS1="$PS1[\${name}] "`,
      `    export PATH="$PATH:$HOME/.cargo/bin:\${./.}/node_modules/.bin"`,
      `  '';`,
      `}`,
    ].join('\n'))
    this.files.cargoToml.as(TextFile).save([
      `[workspace]`, `resolver = "2"`, `members = [`,
      Object.values(this.crates).map(crate=>`  "contracts/${crate.name}"`).sort().join(',\n'),
      `]`
    ].join('\n'))
    this.files.fadromaJson.save({ templates: templates })
    this.files.pnpmWorkspace.save('')
    Object.values(this.packages).forEach(pkg=>pkg.create())
    Object.values(this.crates).forEach(crate=>crate.create())
    Object.values(this.dirs).forEach(dir=>dir.make())
    //let artifacts = ``
    //const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    //const contracts = Object.keys(this.templates)
    //this.files.checksums.save(contracts.map(contract=>`${sha256}  ${contract}@HEAD.wasm`).join('\n'))
    return this
  }
  /** @returns stateless handles for the subdirectories of the project. */
  get dirs () {
    return {
      contracts: this.root.in('contracts').as(OpaqueDirectory),
      dist:      this.root.in('dist').as(OpaqueDirectory),
      state:     this.root.in('state').as(OpaqueDirectory)
    }
  }
  /** @returns stateless handles for various config files that are part of the project. */
  get files () {
    const { contracts, dist, state } = this.dirs
    return {
      cargoToml:      this.root.at('Cargo.toml').as(TOMLFile),
      dockerfile:     null,
      droneWorkflow:  null,
      envfile:        this.root.at('.env').as(TextFile),
      fadromaJson:    this.root.at('fadroma.json').as(JSONFile),
      githubWorkflow: null,
      gitignore:      this.root.at('.gitignore').as(TextFile),
      pnpmWorkspace:  this.root.at('pnpm-workspace.yaml').as(TextFile),
      readme:         this.root.at('README.md').as(TextFile),
      shellNix:       this.root.at('shell.nix').as(TextFile),
    }
  }
  /** @returns stateless handles for NPM packages that are part of the project. */
  get packages () {
    return {
      workspace: new RootPackage(this, 'ops', this.root),
      client:    new ClientPackage(this, 'client'),
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
    ...this.dirs.dist.list()?.filter(x=>x.endsWith('.wasm'))        ?? [],
    ...this.dirs.dist.list()?.filter(x=>x.endsWith('.wasm.sha256')) ?? [],
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
    return await this.uploader.uploadMany(templates as (Template<any> & Buildable & Built & Uploadable)[])
  }
  getUploadState = (chainId: ChainId|null = this.config.chainId) =>
    chainId ? this.dirs.state.in(chainId).in('upload').as(OpaqueDirectory).list() : {}
  deploy = async (...args: string[]) => {
    return await this.getDeployment()?.deploy()
  }
  getDeployState = (chainId: ChainId|null = this.config.chainId) =>
    chainId ? this.dirs.state.in(chainId).in('deploy').as(OpaqueDirectory).list() : {}
  /** Get the active deployment or a named deployment.
    * @returns Deployment|null */
  getDeployment (name?: string): Deployment|null {
    return this.config.getDeployment(this.Deployment)
  }
  static load = (path: string|OpaqueDirectory = process.cwd()): Project|null => {
    const configFile = $(path, 'fadroma.json').as(JSONFile)
    if (configFile.exists()) {
      return new Project(configFile.load() as Partial<Project>)
    } else {
      return null
    }
  }
  static wizard = async (options: Partial<{
    name: string,
    root: string|OpaqueDirectory,
    templates: Awaited<ReturnType<typeof Project.askTemplates>>
  }>): Promise<Project> => {
    options = { ...options }
    const name = options.name ??= await this.askName()
    const root = options.root = $(options.root ?? await this.askRoot(name)).as(OpaqueDirectory)
    const templates = options.templates ??= await this.askTemplates(options.name)
    const project = new Project({ name, root, templates: templates as any })
    await project.create()
    project.runShellCommands(
      'git init',
      'pnpm i',
      //'cargo doc --all-features',
      'git add .',
      'git status',
      'git commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git log",
    )
    console.log("Project created at", project.root.shortPath)
    //console.info(`View documentation at ${root.in('target').in('doc').in(name).at('index.html').url}`)
    return project
  }
  static async askName (): Promise<string> {
    let value
    while ((value = (await askText('Enter a project name (a-z, 0-9, dash/underscore)')??'').trim()) === '') {}
    return value
  }
  static askRoot (name: string): Promise<Path> {
    const cwd = $(process.cwd())
    return askSelect(`Create project ${name} in current directory or subdirectory?`, [
      { title: `Subdirectory (${cwd.name}/${name})`, value: cwd.in(name) },
      { title: `Current directory (${cwd.name})`,    value: cwd },
    ])
  }
  static askTemplates (name: string):
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
      state[crate] = { crate }
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
      state[name] = state[contract]
      delete state[contract]
    }
  }
  // TODO: ask/autodetect: build (docker/podman/raw), devnet (docker/podman)
}

export function askText <T> (message: string) {
  return prompts.prompt({ type: 'text', name: 'value', message })
    .then((x: { value: T })=>x.value)
}

export function askSelect <T> (message: string, choices: any[]) {
  return prompts.prompt({ type: 'select', name: 'value', message, choices })
    .then((x: { value: T })=>x?.value)
}

export async function askUntilDone <S> (state: S, selector: (state: S)=>Promise<Function|null>|Function|null) {
  let action = null
  while (typeof (action = await Promise.resolve(selector(state))) === 'function') {
    await Promise.resolve(action(state))
  }
  return state
}

export class ContractCrate {
  constructor (
    readonly project: Project,
    /** Name of crate */
    readonly name: string,
    /** Features of the 'fadroma' dependency to enable. */
    readonly fadromaFeatures: string[] = [ 'scrt' ],
    /** Root directory of crate. */
    readonly dir: OpaqueDirectory = project.dirs.contracts.in(name).as(OpaqueDirectory),
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

export class NPMPackage {
  constructor (
    readonly project: Project,
    /** Name of package. */
    readonly name: string,
    /** Directory of package. */
    readonly dir: OpaqueDirectory = project.root.in(name).as(OpaqueDirectory),
    /** Package manifest. */
    readonly packageJson: JSONFile<any> = dir.at('package.json').as(JSONFile),
    /** Main module */
    readonly index: TextFile = dir.at(`${name}.ts`).as(TextFile),
    /** Test specification. */
    readonly spec: TextFile = dir.at(`${name}.spec.ts`).as(TextFile)
  ) {}
  create (packageJson: object = {}) {
    this.dir.make()
    this.packageJson.save(packageJson)
  }
}

export class ClientPackage extends NPMPackage {
  create () {
    super.create({
      name: `@${this.project.name}/${this.name}`,
      main: `${this.name}.ts`,
      type: "module",
      version: "0.0.0",
      dependencies: {
        "@fadroma/agent": "latest",
        "@fadroma/scrt":  "latest",
      },
    })
    const names = Object.keys(this.project.templates)
    this.index.save([
      `import { Client, Deployment } from '@fadroma/agent'`,
      [
        `export default class ${Case.pascal(this.project.name)} extends Deployment {`,
        ...names.map(name => [
          `  ${name} = this.name(`,
          `{ name: "${name}", crate: "${name}", client: ${Case.pascal(name)} })`
        ].join('')),
        '}',
      ].join('\n'),
      ...names.map(Case.pascal).map(Contract => [
        `export class ${Contract} extends Client {`,
        `  // myTx1    = (arg1, arg2) => this.execute({myTx1:{arg1, arg2}})`,
        `  // myTx2    = (arg1, arg2) => this.execute({myTx2:{arg1, arg2}})`,
        `  // myQuery1 = (arg1, arg2) => this.query({myQuery1:{arg1, arg2}})`,
        `  // myQuery2 = (arg1, arg2) => this.query({myQuery2:{arg1, arg2}})`,
        `}\n`
      ].join('\n'))
    ].join('\n\n'))
  }
}

export class RootPackage extends NPMPackage {
  create () {
    super.create({
      name: `@${this.project.name}/${this.name}`,
      main: `${this.name}.ts`,
      type: "module",
      private: true,
      devDependencies: {
        "@hackbg/fadroma": "latest",
        "@hackbg/ganesha": "latest",
        [`@${this.project.name}/client`]: "link:./client",
      },
      scripts: {
        "build":   "fadroma build",
        "status":  "fadroma status",
        "mocknet": `FADROMA_OPS=./${this.name}.ts FADROMA_CHAIN=Mocknet_CW1 fadroma`,
        "devnet":  `FADROMA_OPS=./${this.name}.ts FADROMA_CHAIN=ScrtDevnet fadroma`,
        "testnet": `FADROMA_OPS=./${this.name}.ts FADROMA_CHAIN=ScrtTestnet fadroma`,
        "mainnet": `FADROMA_OPS=./${this.name}.ts FADROMA_CHAIN=ScrtMainnet fadroma`,
      },
    })
    const imports = [
      `import ${Case.pascal(this.project.name)} from '@${this.project.name}/client'`,
      `import Project from '@hackbg/fadroma'`,
    ].join('\n')
    const commandsClass = [
      `export default class ${Case.pascal(this.project.name)}Project extends Project {`, ``,
      `  Deployment = ${Case.pascal(this.project.name)}`, ``,
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
    this.index.save([imports, commandsClass].join('\n\n'))
  }
}


const { text, select } = prompts.prompts

export function askDonation () {
}

export function isGitRepo () {
}

export function checkSystemDependencies () {
  //console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  checkSystemDependency('Git:    ', 'git --version')
  checkSystemDependency('Node:   ', 'node --version')
  checkSystemDependency('NPM:    ', 'npm --version')
  checkSystemDependency('Yarn:   ', 'yarn --version')
  checkSystemDependency('PNPM:   ', 'pnpm --version')
  checkSystemDependency('Cargo:  ', 'cargo --version')
  checkSystemDependency('Docker: ', 'docker --version')
  checkSystemDependency('Nix:    ', 'nix --version')
}

export function checkSystemDependency (dependency: string, command: string) {
  let version = null
  try {
    const version = execSync(command)
    console.log(' ', bold(dependency), String(version).trim())
  } catch (e) {
    console.log(' ', bold(dependency), colors.yellow('(not found)'))
  } finally {
    return version
  }
}

//@ts-ignore
export const { version } = $(import.meta.url, '../package.json').as(JSONFile).load() as any

export class TemplateCommands extends CommandContext {
  constructor (readonly project: Project) { super() }
  add = this.command('add', 'add a new contract template to the project',
    () => { throw new Error('not implemented') })
  list = this.command('list', 'list contract templates defined in this project',
    () => { throw new Error('not implemented') })
  del = this.command('del', 'delete a contract template from this project',
    () => { throw new Error('not implemented') })
}

export class DevnetCommands extends CommandContext {

  constructor (public chain?: Chain) {
    super('Fadroma Devnet')
    //// Define CLI commands
    //this.command('reset',  'kill and erase the devnet', () => {})
    //this.command('stop',   'gracefully pause the devnet', () => {})
    //this.command('kill',   'terminate the devnet immediately', () => {})
    //this.command('export', 'stop the devnet and save it as a new Docker image', () => {})
  }

  status = this.command('status', 'print the status of the current devnet', () => {
    const { chain } = this
    return this
  })

  reset = this.command('reset', 'erase the current devnet', async (chain = this.chain) => {
    if (!chain) {
      this.log.info('No active chain.')
    } else if (!chain.isDevnet || !chain.node) {
      this.log.error('This command is only valid for devnets.')
    } else {
      await chain.node.terminate()
    }
  })

}

export class DeploymentCommands extends CommandContext {
  constructor (
    readonly chainId?: ChainId,
    readonly store: DeployStore = new Config().getDeployStore(),
  ) {
    super()
    if (chainId) {
      this.command('list',   `list all deployments on ${chainId}`,          this.list)
      this.command('create', `create a new empty deployment in ${chainId}`, this.create)
      this.command('select', `activate another deployment on ${chainId}`,   this.select)
      this.command('status', `show status of active deployment`,            this.status)
      this.command('export', `export current deployment to ${name}.json`,   this.export)
    }
  }
  log = new Console.Deploy(`@fadroma/ops`)
  list = () => this.log.deploymentList(this.chainId??'(unspecified)', this.store)
  create = async (name: string) => this.store.create(name).then(()=>this.select(name))
  select = async (name?: string): Promise<DeploymentState|null> => {
    const list = this.store.list()
    if (list.length < 1) throw new Error('No deployments in this store')
    let deployment
    if (name) {
      deployment = await this.store.select(name)
    } else if (this.store.active) {
      deployment = this.store.active
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
    return deployment || null
  }
  status = (name?: string) => {
    const deployment = name ? this.store.save(name) : this.store.active
    if (deployment) {
      this.log.deployment(deployment as any)
    } else {
      throw new Error.Deploy.NoDeployment()
    }
  }
  export = async (path?: string) => {
    const deployment = this.store.active
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
    const file = $(path??'')
      .at(`${deployment.name}.json`)
      .as(JSONFile<typeof state>)
    file.save(state)
    this.log.info('Wrote', Object.keys(state).length, 'contracts to', bold(file.shortPath))
  }
}
