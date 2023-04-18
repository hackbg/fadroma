import { getBuilder } from './build/index'
import { getUploader } from './upload/index'

import type { Builder, Buildable, Uploadable, Built } from '@fadroma/agent'
import { Template } from '@fadroma/agent'

import $, { Path, OpaqueDirectory, OpaqueFile, JSONFile, TOMLFile, TextFile } from '@hackbg/file'
import Console, { bold, colors } from './OpsConsole'

import Case from 'case'
import prompts from 'prompts'

import { execSync } from 'node:child_process'

export type ProjectContract = {
  /** Source crate/workspace. Defaults to root crate of project. */
  source?: string,
  /** -p flag that selects the contract to compile, if the source is a workspace. */
  package?: string,
  /** One or more -f flags that select the contract to compile, if the source is a multi-contract crate. */
  features?: string[]
}

export default class Project {

  static create (
    name: string,
    root: string|Path = $(process.cwd()).in(name),
    templates: Record<string, Template<any>|(Buildable & Partial<Built>)> = {}
  ) {
    if (typeof root === 'string') root = $(root)
    return new this({ name, root: root.as(OpaqueDirectory), templates }).create()
  }

  /** @returns the config of the current project, or the project at the specified path */
  static load (
    path: string|OpaqueDirectory = process.cwd()
  ): Project {
    const packageJSON = $(path).as(OpaqueDirectory).at('package.json').as(JSONFile).load()
    const { fadroma } = packageJSON as { fadroma: any }
    return new Project(fadroma)
  }

  log: Console

  /** Name of the project. */
  name:           string
  /** Root directory of the project. */
  root:           OpaqueDirectory
  /** Root of documentation. */
  readme:         TextFile
  /** List of files to be ignored by Git. */
  gitignore:      TextFile
  /** List of environment variables to set. */
  envfile:        TextFile
  /** Nix dependency manifest. */
  shellNix:       TextFile
  /** A custom Dockerfile for building the project. */
  dockerfile:     TextFile|null = null
  /** A GitHub Actions CI workflow. */
  githubWorkflow: TextFile|null = null
  /** A Drone CI workflow. */
  droneWorkflow:  TextFile|null = null
  /** Root package manifest. */
  packageJson:    JSONFile<any>
  /** Empty file that enables PNPM workspaces. */
  pnpmWorkspace:  TextFile

  constructor (options?: {
    name?: string,
    root?: string|OpaqueDirectory,
    templates: Record<string, Template<any>|(Buildable & Partial<Built>)>
  }) {
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
    // Define project files and subdirectories
    this.gitignore     = root.at('.gitignore').as(TextFile)
    this.envfile       = root.at('.env').as(TextFile)
    this.readme        = root.at('README.md').as(TextFile)
    this.shellNix      = root.at('shell.nix').as(TextFile)
    this.packageJson   = root.at('package.json').as(JSONFile)
    this.pnpmWorkspace = root.at('pnpm-workspace.yaml').as(TextFile)
    this.packages = { api: new APIPackage(this, 'api'), ops: new OpsPackage(this, 'ops') }
    this.state    = new ProjectState(this)
  }

  /** NPM packages in workspace. */
  packages: Record<string, NPMPackage>

  /** Crates in workspace. */
  crates: Record<string, ContractCrate>

  /** Contract definitions. */
  templates: Record<string, Template<any>>

  getTemplate (name: string): (Template<any> & Buildable)|undefined {
    return this.templates[name] as Template<any> & Buildable
  }

  setTemplate (
    name:  string,
    value: string|Template<any>|(Buildable & Partial<Built>)
  ): Template<any> {
    return this.templates[name] =
      (typeof value === 'string') ? new Template({ workspace: '.', crate: value }) :
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

  /** Project state directory. Contains history of builds, uploads, and deploys */
  state: ProjectState

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

    this.readme.save([
      `# ${name}\n`,
      `Made with [Fadroma](https://fadroma.tech)`
    ].join('\n'))

    this.gitignore.save([
      '.env',
      'node_modules',
      'target'
    ].join('\n'))

    this.envfile.save('')

    this.shellNix.save([
      `{ pkgs ? import <nixpkgs> {}, ... }: let name = "${name}"; in pkgs.mkShell {`,
      `  inherit name;`,
      `  nativeBuildInputs = with pkgs; [ git nodejs nodePackages_latest.pnpm rustup ];`,
      `  shellHook = ''`,
      `    export PS1="$PS1[\${name}] "`,
      `    export PATH="$PATH:$HOME/.cargo/bin:\${./.}/node_modules/.bin"`,
      `  '';`,
      `}`,
    ].join('\n'))

    this.packageJson.save({
      name: `@${name}/workspace`,
      version: "0.0.0",
      private: true,
      scripts: {
        "build":   "fadroma build",
        "mocknet": "FADROMA_CHAIN=Mocknet_CW1 fadroma ./ops",
        "devnet":  "FADROMA_CHAIN=ScrtDevnet fadroma ./ops",
        "testnet": "FADROMA_CHAIN=ScrtTestnet fadroma ./ops",
        "mainnet": "FADROMA_CHAIN=ScrtMainnet fadroma ./ops",
      },
      devDependencies: {
        "@hackbg/fadroma": "latest",
      },
      fadroma: {
        templates: templates
      }
    })

    this.pnpmWorkspace.save('')

    this.state.create()

    Object.values(this.packages).forEach(pkg=>pkg.create())

    Object.values(this.crates).forEach(crate=>crate.create())

    return this
  }

}

export class ProjectState {
  /** Crate manifest. */
  dir: OpaqueDirectory
  /** File containing build artifact checksums. */
  artifacts: TextFile
  /** Directory containing upload receipts. */
  uploads: OpaqueDirectory
  /** Directory containing deployment receipts. */
  receipts: OpaqueDirectory

  constructor (readonly project: Project) {
    this.dir = project.root.in('state').as(OpaqueDirectory)
    this.artifacts = this.dir.at('artifacts.sha256').as(TextFile)
    this.uploads   = this.dir.in('uploads').as(OpaqueDirectory)
    this.receipts  = this.dir.in('receipts').as(OpaqueDirectory)
  }

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
  /** Directory containing api library. */
  dir:         OpaqueDirectory
  /** API package manifest. */
  packageJson: JSONFile<any>
  /** Main module */
  index:       TextFile
  /** Test specification. */
  spec:        TextFile

  constructor (
    readonly project: Project,
    readonly name:    string,
  ) {
    this.dir = project.root.in(name).as(OpaqueDirectory)
    this.packageJson = this.dir.at('package.json').as(JSONFile)
    this.index       = this.dir.at(`${name}.ts`).as(TextFile)
    this.spec        = this.dir.at(`${name}.spec.ts`).as(TextFile)
  }

  create (packageJson: object = {}) {
    this.dir.make()
    this.packageJson.save(packageJson)
  }
}

export class APIPackage extends NPMPackage {
  create () {
    super.create({
      name: `@${this.project.name}/${this.name}`,
      version: "0.0.0",
      dependencies: {
        "@fadroma/agent": "^1",
        "@fadroma/scrt":  "^8",
      },
      main: `${this.name}.ts`
    })

    const imports = `import { Client, Deployment } from '@fadroma/agent'`

    const contracts = Object.keys(this.project.crates)

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
      private: true,
      devDependencies: { "@fadroma/ops": "^3", [`@${this.project.name}/api`]: "workspace:*" },
      main: `${this.name}.ts`
    })

    const imports = [
      `import ${Case.pascal(this.project.name)} from '@${this.project.name}/api'`,
      `import { FadromaCommands } from '@fadroma/ops'`,
    ].join('\n')

    const commandsClass = [
      `export default class ${Case.pascal(this.project.name)}Commands extends FadromaCommands {`,
      `}`
    ].join('\n')

    this.index.save([imports, commandsClass].join('\n\n'))
  }
}

export class ContractCrate {
  dir:       OpaqueDirectory
  /** Crate manifest. */
  cargoToml: TextFile
  /** Directory containing crate sources. */
  src:       OpaqueDirectory
  /** Root module of Rust crate. */
  libRs:     TextFile

  constructor (
    readonly project: Project,
    readonly name:    string,
    readonly fadromaFeatures: string[] = [ 'scrt' ]
  ) {
    this.dir       = project.root.in(name).as(OpaqueDirectory)
    this.cargoToml = this.dir.at('Cargo.toml').as(TextFile)
    this.src       = this.dir.in('src').as(OpaqueDirectory)
    this.libRs     = this.src.at('lib.rs').as(TextFile)
  }

  create () {
    this.cargoToml.save([
      `[package]`,
      `name = "${this.project.name}"`,
      `version = "0.0.0"`,
      `edition = "2021"`,
      `authors = []`,
      `license = "AGPL-3.0"`,
      `keywords = ["fadroma"]`,
      `description = ""`,
      `readme = "README.md"`,
      ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { version = "0.9.0", features = ${JSON.stringify(this.fadromaFeatures)} }`
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

const console = new Console('@fadroma/project')

export async function projectWizard () {
  const name = await askProjectName()
  const root = await askSubdirectory(name)
  const contracts = await askContracts(name)
  Project.create(name, root, contracts)
  console.log("Initializing project:")
  run(root.path, 'git init')
  run(root.path, 'pnpm i')
  run(root.path, 'cargo doc --all-features')
  run(root.path, 'git add .')
  run(root.path, 'git status')
  run(root.path, 'git commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"')
  console.br()
  console.log("Project initialized.")
  console.info(`View documentation at ${root.in('target').in('doc').in(name).at('index.html').url}`)
}

export function run (cwd: string, cmd: string) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

export async function askProjectName (): Promise<string> {
  let value
  while ((value = (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a project name (a-z, 0-9, dash/underscore)'
  })).value.trim()) === '') {}
  return value
}

export async function askSubdirectory (name: string): Promise<Path> {
  const cwd = $(process.cwd())
  return (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Create project ${name} in current directory or subdirectory?`,
    choices: [
      { title: `Subdirectory (${cwd.name}/${name})`, value: cwd.in(name) },
      { title: `Current directory (${cwd.name})`, value: cwd },
    ]
  })).value
}

export async function askContracts (name: string): Promise<{}> {
  let contracts = {}
  let action = await askContractAction(name, contracts)
  while (typeof action === 'function') {
    await Promise.resolve(action(contracts))
    action = await askContractAction(name, contracts)
  }
  return contracts
}

export async function askContractAction (
  name: string,
  contracts: Record<string, any>
): Promise<Function|null> {
  const length = Object.keys(contracts).length
  const names  = Object.keys(contracts).join(', ')
  return (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Project ${name} contains ${length} contract(s): ${names}`,
    choices: [
      { title: `Add contract`,    value: defineContract },
      { title: `Remove contract`, value: undefineContract },
      { title: `Rename contract`, value: renameContract },
      { title: `(done)`,          value: null },
    ]
  })).value
}

export async function defineContract (contracts: Record<string, any>) {
  const name = (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a name for the new contract (a-z, 0-9, dash/underscore):'
  })).value
  contracts[name] = {}
}

export async function undefineContract (contracts: Record<string, any>) {
  const name = (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Select contract to remove from project scope:`,
    choices: [
      ...Object.keys(contracts).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })).value
  delete contracts[name]
}

export async function renameContract (contracts: Record<string, any>) {
  const contract = (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Select contract to rename:`,
    choices: [
      ...Object.keys(contracts).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })).value
  const name = (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: `Enter a new name for ${contract} (a-z, 0-9, dash/underscore):`
  })).value
  contracts[name] = contracts[contract]
  delete contracts[contract]
}

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

