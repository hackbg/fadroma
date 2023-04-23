import { getBuilder } from './build/index'
import { getUploader } from './upload/index'

import type { Builder, Buildable, Uploadable, Built } from '@fadroma/agent'
import { Template } from '@fadroma/agent'

import Case from 'case'
import prompts from 'prompts'

import { execSync } from 'node:child_process'
import $, { Path, OpaqueDirectory, OpaqueFile, JSONFile, TOMLFile, TextFile } from '@hackbg/file'
import Console, { bold, colors } from './OpsConsole'

const console = new Console('@fadroma/project')

export default class Project {

  /** @returns the config of the current project, or the project at the specified path */
  log: Console

  /** Name of the project. */
  name: string

  /** Root directory of the project. */
  root: OpaqueDirectory

  /** Contract definitions. */
  templates: Record<string, Template<any>>

  /** Contract crates in project. */
  crates: Record<string, ContractCrate>

  /** NPM packages in workspace. */
  packages:  Record<string, NPMPackage>

  /** Project state directory. Contains history of builds, uploads, and deploys */
  state: ProjectState

  /** Various files comprising the project infrastructure. */
  get files () {
    return {
      readme:         this.root.at('README.md').as(TextFile),
      gitignore:      this.root.at('.gitignore').as(TextFile),
      envfile:        this.root.at('.env').as(TextFile),
      shellNix:       this.root.at('shell.nix').as(TextFile),
      packageJson:    this.root.at('package.json').as(JSONFile),
      cargoToml:      this.root.at('Cargo.toml').as(TOMLFile),
      pnpmWorkspace:  this.root.at('pnpm-workspace.yaml').as(TextFile),
      dockerfile:     null,
      githubWorkflow: null,
      droneWorkflow:  null
    }
  }

  constructor (options?: Partial<Project & {
    templates: Record<string, Template<any>|(Buildable & Partial<Built>)>
  }>) {
    // Handle options
    const root = $(options?.root || process.cwd()).as(OpaqueDirectory)
    const name = options?.name || root.name
    this.log = new Console(`Project: ${name}`)
    const templates = options?.templates || {}
    this.name = name
    this.root = root
    // Hydrate project templates
    this.templates = {}
    this.crates = {}
    for (const [key, val] of Object.entries(options?.templates || {})) {
      const template = this.setTemplate(key, val)
      if (template.crate) this.crates[key] = new ContractCrate(this, template.crate)
    }
    this.packages = {
      api: new APIPackage(this, 'api'),
      ops: new OpsPackage(this, 'ops')
    }
    this.state = new ProjectState(this)
  }

  run (...cmds: string[]) {
    return cmds.map(cmd=>execSync(cmd, { cwd: this.root.path, stdio: 'inherit' }))
  }

  getTemplate (name: string): (Template<any> & Buildable)|undefined {
    return this.templates[name] as Template<any> & Buildable
  }

  setTemplate (
    name: string, value: string|Template<any>|(Buildable & Partial<Built>)
  ): Template<any> {
    return this.templates[name] =
      (typeof value === 'string') ? new Template({ workspace: this.root.path, crate: value }) :
      (value instanceof Template) ? value : new Template(value)
  }

  build (names: string[], builder = getBuilder()) {
    const templates = names.map(name=>this.getTemplate(name)).filter(Boolean)
    return builder.buildMany(templates as (Template<any> & Buildable)[])
  }

  buildAll (builder = getBuilder()) {
    this.log.info('Building all contracts:', Object.keys(this.templates).join(', '))
    return this.build(Object.keys(this.templates), builder)
  }

  async upload (names: string[], uploader = getUploader(), builder?: Builder) {
    const templates = names.map(name=>this.getTemplate(name)).filter(Boolean)
    if (builder) await builder.buildMany(templates as (Template<any> & Buildable)[])
    return uploader.uploadMany(templates as (Template<any> & Uploadable)[])
  }

  uploadAll (uploader = getUploader(), builder?: Builder) {
    return this.upload(Object.keys(this.templates))
  }

  getBuildState () {
    return this.state.artifacts.load()
  }

  getUploadState () {
    return this.state.uploads.list()
  }

  getDeployState () {
    return this.state.uploads.list()
  }

  getCurrentDeployment () {
    return undefined
  }

  create () {
    const { name, templates } = this

    this.root.make()

    this.files.readme.save([
      `# ${name}\n---\n`,
      `Made with [Fadroma](https://fadroma.tech)',
      'provided courtesy of [Hack.bg](https://hack.bg)',
      'under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
    ].join(''))

    this.files.gitignore.save([ '.env', 'node_modules', 'target' ].join('\n'))

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
      `[workspace]`,
      `resolver = "2"`,
      `members = [`,
      Object.values(this.crates).map(crate=>`  "${crate.name}"`).sort().join(',\n'),
      `]`
    ].join('\n'))

    Object.values(this.crates).forEach(crate=>crate.create())

    this.files.packageJson.save({
      name: `@${name}/workspace`,
      version: "0.0.0",
      private: true,
      scripts: {
        "build":   "fadroma build",
        "mocknet": "FADROMA_OPS=./ops FADROMA_CHAIN=Mocknet_CW1 fadroma ./ops",
        "devnet":  "FADROMA_OPS=./ops FADROMA_CHAIN=ScrtDevnet fadroma ./ops",
        "testnet": "FADROMA_OPS=./ops FADROMA_CHAIN=ScrtTestnet fadroma ./ops",
        "mainnet": "FADROMA_OPS=./ops FADROMA_CHAIN=ScrtMainnet fadroma ./ops",
      },
      devDependencies: {
        "@hackbg/fadroma": "latest",
      },
      fadroma: {
        templates: templates
      }
    })
    this.files.pnpmWorkspace.save('')
    Object.values(this.packages).forEach(pkg=>pkg.create())

    this.state.create()
    return this
  }

  static load (path: string|OpaqueDirectory = process.cwd()): Project|null {
    const configFile = $(path, 'fadroma.json').as(JSONFile)
    if (configFile.exists()) {
      return new Project(configFile.load() as Partial<Project>)
    } else {
      return null
    }
  }

  static async create (options: Partial<{
    name: string,
    root: string|OpaqueDirectory,
    templates: Awaited<ReturnType<typeof Project.askTemplates>>
  }>): Promise<Project> {
    options = { ...options }
    const name = options.name ??= await this.askName()
    const root = options.root = $(options.root ?? await this.askRoot(name)).as(OpaqueDirectory)
    const templates = options.templates ??= await this.askTemplates(options.name)
    const project = new Project({ name, root, templates: templates as any })
    await project.create()
    project.run(
      'git init',
      'pnpm i',
      'cargo doc --all-features',
      'git add .',
      'git status',
      'git commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git log",
    )
    console.log("Project initialized.")
    console.info(`View documentation at ${root.in('target').in('doc').in(name).at('index.html').url}`)
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

}

function askText <T> (message: string) {
  return prompts.prompt({ type: 'text', name: 'value', message })
    .then((x: { value: T })=>x.value)
}

function askSelect <T> (message: string, choices: any[]) {
  return prompts.prompt({ type: 'select', name: 'value', message, choices })
    .then((x: { value: T })=>x?.value)
}

async function askUntilDone <S> (state: S, selector: (state: S)=>Promise<Function|null>|Function|null) {
  let action = null
  while (typeof (action = await Promise.resolve(selector(state))) === 'function') {
    await Promise.resolve(action(state))
  }
  return state
}

export class ProjectState {

  constructor (
    readonly project: Project,
    /** Root of project state. */
    readonly dir: OpaqueDirectory = project.root.in('state').as(OpaqueDirectory),
    /** File containing build artifact checksums. */
    readonly artifacts: TextFile = dir.at('artifacts.sha256').as(TextFile),
    /** Directory containing upload receipts. */
    readonly uploads: OpaqueDirectory = dir.in('uploads').as(OpaqueDirectory),
    /** Directory containing deployment receipts. */
    readonly receipts: OpaqueDirectory = dir.in('receipts').as(OpaqueDirectory),
  ) {}

  create () {
    let artifacts = ``
    const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    const contracts = Object.keys(this.project.templates)
    this.artifacts.save(contracts.map(contract=>`${sha256}  ${contract}@HEAD.wasm`).join('\n'))
    this.uploads.make()
    this.receipts.make()
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

export class APIPackage extends NPMPackage {
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

    const imports = `import { Client, Deployment } from '@fadroma/agent'`

    const contracts = Object.keys(this.project.templates)

    const deploymentClass = [
      `export default class ${Case.pascal(this.project.name)} extends Deployment {`,
      ...contracts.map(contract => [
        `  ${contract} = this.contract(`,
        `{ name: "${contract}", crate: "${contract}", client: ${Case.pascal(contract)} })`
      ].join('')),
      '}',
    ].join('\n')

    const clientClasses = contracts.map(Case.pascal).map(Contract => [
      `export class ${Contract} extends Client {`,
      `  // myTx1    = (arg1, arg2) => this.execute({myTx1:{arg1, arg2}})`,
      `  // myTx2    = (arg1, arg2) => this.execute({myTx2:{arg1, arg2}})`,
      `  // myQuery1 = (arg1, arg2) => this.query({myQuery1:{arg1, arg2}})`,
      `  // myQuery2 = (arg1, arg2) => this.query({myQuery2:{arg1, arg2}})`,
      `}\n`
    ].join('\n'))

    this.index.save([ imports, deploymentClass, ...clientClasses ].join('\n\n'))
  }
}

export class OpsPackage extends NPMPackage {
  create () {
    super.create({
      name: `@${this.project.name}/${this.name}`,
      main: `${this.name}.ts`,
      type: "module",
      private: true,
      devDependencies: {
        "@fadroma/ops": "latest",
        [`@${this.project.name}/api`]: "link:../api"
      },
    })

    const imports = [
      `import ${Case.pascal(this.project.name)} from '@${this.project.name}/api'`,
      `import { FadromaCommands } from '@fadroma/ops'`,
    ].join('\n')

    const commandsClass = [
      `export default class ${Case.pascal(this.project.name)}Commands extends FadromaCommands {`,
      ``,
      `  // Override to customize the build command:`,
      `  //`,
      `  // build = async (...contracts: string[]) => { `,
      `  //   await super.build(...contracts)`,
      `  // }`,
      ``,
      `  // Override to customize the upload command:`,
      `  //`,
      `  // upload = async (...contracts: string[]) => {`,
      `  //   await super.upload(...contracts)`,
      `  // }`,
      ``,
      `  // Override to customize the deploy command:`,
      `  //`,
      `  // deploy = async (...args: string[]) => {`,
      `  //   await super.deploy(...args)`,
      `  // }`,
      ``,
      `  // Override to customize the status command:`,
      `  //`,
      `  // status = async (...args: string[]) => {`,
      `  //   await super.status()`,
      `  // }`,
      ``,
      `  // Define custom commands using \`this.command\`:`,
      `  //`,
      `  // custom = this.command('custom', 'run a custom procedure', async () => {`,
      `  //   // ...`,
      `  // })`,
      ``,
      `}`
    ].join('\n')

    this.index.save([imports, commandsClass].join('\n\n'))
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
    readonly dir: OpaqueDirectory = project.root.in(name).as(OpaqueDirectory),
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

