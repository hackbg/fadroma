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
  Agent, CompiledCode, ChainId, ContractCode
} from '@fadroma/connect'
import $, {
  TextFile, OpaqueDirectory,
  YAMLFile,
  TOMLFile,
  JSONFile, JSONDirectory
} from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { CommandContext } from '@hackbg/cmds'
import * as Compilers from './build'
import { console } from './config'
import * as Stores from './stores'
import * as Devnets from './devnets'
import * as Prompts from './prompts'
import * as Tools from './tools'
import { execSync } from 'node:child_process'
import Case from 'case'

export class ProjectRoot {

  readonly root: Path

  constructor (readonly name: string, root: string|Path) {
    if (!name) {
      throw new Error('missing project name')
    }
    if (!root) {
      throw new Error('missing project root directory')
    }
    this.root = $(root)
  }

  logStatus () {
    return console.br()
      .info('Project name: ', bold(this.name))
      .info('Project root: ', bold(this.root.path))
  }

  static async create (properties: Partial<{
    tools?: Tools.SystemTools,
    interactive?: boolean,
    name?: string
    root?: string|Path
  }>) {
    const { tools = new Tools.SystemTools(), interactive = tools.interactive } =
      properties
    const { name = await Promise.resolve(interactive ? this.askName() : undefined) } =
      properties
    if (!name) {
      throw new Error('missing project name')
    }
    let { root = await Promise.resolve(interactive ? this.askRoot(name) : undefined) } =
      properties
    if (!root) {
      root = $(tools.cwd, name as string)
    }
    root = $(root).as(OpaqueDirectory)
    console.log(`Creating project`, bold(name), `in`, bold(root.path))
    const project = new this(name!, root.make())
    Tools.createGitRepo(root.path, tools)
    return project
  }

  static async askName (): Promise<string> {
    let value
    do {
      value = await Prompts.askText('Enter a project name (a-z, 0-9, dash/underscore)')??''
      value = value.trim()
      if (!isNaN(value[0] as any)) {
        console.info('Project name cannot start with a digit.')
        value = ''
      }
    } while (value === '')
    return value
  }

  static async askRoot (name: string|Promise<string>|undefined): Promise<Path> {
    name = await Promise.resolve(name) as string
    const cwd    = $(process.cwd()).as(OpaqueDirectory)
    const exists = cwd.in(name).exists()
    const inSub  = `Subdirectory (${exists?'overwrite: ':''}${cwd.name}/${name})`
    const inCwd  = `Current directory (${cwd.name})`
    const choice = [
      { title: inSub, value: cwd.in(name) },
      { title: inCwd, value: cwd },
    ]
    if ((cwd.list()?.length||0) === 0) {
      choice.reverse()
    }
    return Prompts.askSelect(
      `Create project ${name} in current directory or subdirectory?`, choice
    )
  }

}

export class Project extends ProjectRoot {
  stateDir     = $(this.root, 'state')
    .as(OpaqueDirectory)
  wasmDir      = $(this.root, 'wasm')
    .as(OpaqueDirectory)
  envFile      = $(this.root, '.env')
    .as(TextFile)
  gitIgnore    = $(this.root, '.gitignore')
    .as(TextFile)
  packageJson  = $(this.root, 'package.json')
    .as(JSONFile)
  readme       = $(this.root, 'README.md')
    .as(TextFile)
  shellNix     = $(this.root, 'shell.nix')
    .as(TextFile)
  apiIndex     = $(this.root, 'index.ts')
    .as(TextFile)
  projectIndex = $(this.root, 'fadroma.config.ts')
    .as(TextFile)
  testIndex    = $(this.root, 'test.ts')
    .as(TextFile)

  logStatus () {
    return super.logStatus().br()
      .info('Project state: ', bold(this.stateDir.shortPath))
      .info('Build results: ', bold(this.wasmDir.shortPath))
      .br().info('Deployment units: ')
      .warn('(TODO)')
  }

  createDeployment (): Deployment {
  }

  getDeployment (): Deployment {
  }

  static async create ({ // do not convert to arrow function
    tools = new Tools.SystemTools(),
    interactive = tools.interactive,
    name,
    root
  }: {
    tools?: Tools.SystemTools,
    interactive?: boolean,
    name?: string,
    root?: string|Path|Promise<string|Path>|undefined,
  }) {
    const project = await super.create({ tools, name, root }) as Project
    if (!name) {
      throw new Error("missing project name")
    }
    project.readme.save(
      Tools.generateReadme(name)
    )
    project.packageJson.save(
      Tools.generatePackageJson(name)
    )
    project.gitIgnore.save(
      Tools.generateGitIgnore()
    )
    project.envFile.save(
      Tools.generateEnvFile()
    )
    project.shellNix.save(
      Tools.generateShellNix(name)
    )
    project.apiIndex.save(
      Tools.generateApiIndex(name, {})
    )
    project.projectIndex.save(
      Tools.generateProjectIndex(name)
    )
    project.testIndex.save(
      Tools.generateTestIndex(name)
    )
    Tools.runNPMInstall(
      project, tools
    )
    return project
  }

  static async askTemplates (name: string): Promise<Record<string, Partial<UploadedCode>>> {

    return Prompts.askUntilDone({}, (state) => Prompts.askSelect([
      `Project ${name} contains ${Object.keys(state).length} contract(s):\n`,
      `  ${Object.keys(state).join(',\n  ')}`
    ].join(''), [
      { title: `Add contract template to the project`, value: defineContract },
      { title: `Remove contract template`, value: undefineContract },
      { title: `Rename contract template`, value: renameContract },
      { title: `(done)`, value: null },
    ]))

    async function defineContract (state: Record<string, any>) {
      let crate
      crate = await Prompts.askText('Enter a name for the new contract (lowercase a-z, 0-9, dash, underscore):')??''
      if (!isNaN(crate[0] as any)) {
        console.info('Contract name cannot start with a digit.')
        crate = ''
      }
      if (crate) {
        state[crate] = { crate }
      }
    }

    async function undefineContract (state: Record<string, any>) {
      const name = await Prompts.askSelect(`Select contract to remove from project scope:`, [
        ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
        { title: `(done)`, value: null },
      ])
      if (name === null) return
      delete state[name]
    }

    async function renameContract (state: Record<string, any>) {
      const name = await Prompts.askSelect(`Select contract to rename:`, [
        ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
        { title: `(done)`, value: null },
      ])
      if (name === null) return
      const newName = await Prompts.askText(`Enter a new name for ${name} (a-z, 0-9, dash/underscore):`)
      if (newName) {
        state[newName] = Object.assign(state[name], { name: newName })
        delete state[name]
      }
    }

  }
}

export class ScriptProject extends Project {
  logStatus () {
    return super.logStatus().br()
      .info('This project contains no crates.')
  }
}

export class CargoProject extends Project {

  static async create ({ // do not convert to arrow function
    tools = new Tools.SystemTools(), name, root
  }: {
    tools?: Tools.SystemTools, name?: string, root?: string|Path
  }) {
    const project = await super.create({ tools, name, root }) as Project
    if (tools.interactive) {
      switch (await this.askCompiler(tools)) {
        case 'podman':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_PODMAN=1`)
          break
        case 'raw':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_RAW=1`)
          break
      }
    }
    Tools.runCargoUpdate(project, tools)
    Prompts.logInstallRust(tools)
    Prompts.logInstallSha256Sum(tools)
    Prompts.logInstallWasmOpt(tools)
    Tools.gitCommitUpdatedLockfiles(project, tools, changed)
    return project
  }

  static async askCompiler ({
    isLinux,
    cargo  = Tools.NOT_INSTALLED,
    docker = Tools.NOT_INSTALLED,
    podman = Tools.NOT_INSTALLED
  }: Partial<Tools.SystemTools>): Promise<'raw'|'docker'|'podman'> {
    const variant = (value: string, title: string) =>
      ({ value, title })
    const buildRaw = variant('raw',
      `No isolation, build with local toolchain (${cargo||'cargo: not found!'})`)
    const buildDocker = variant('docker',
      `Isolate builds in a Docker container (${docker||'docker: not found!'})`)
    /* TODO: podman is currently disabled
    const buildPodman = variant('podman',
      `Isolate builds in a Podman container (experimental; ${podman||'podman: not found!'})`)
    const hasPodman = podman && (podman !== NOT_INSTALLED)
     const engines = hasPodman ? [ buildPodman, buildDocker ] : [ buildDocker, buildPodman ] */
    const engines = [ buildDocker ]
    const options = isLinux ? [ ...engines, buildRaw ] : [ buildRaw, ...engines ]
    return await Prompts.askSelect(`Select build isolation mode:`, options)
  }

  static writeCrate (path: string|Path, name: string, features: string[]) {
    $(path, 'Cargo.toml')
      .as(TextFile)
      .save([
        `[package]`, `name = "${this.name}"`, `version = "0.0.0"`, `edition = "2021"`,
        `authors = []`, `keywords = ["fadroma"]`, `description = ""`, `readme = "README.md"`, ``,
        `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
        `[dependencies]`,
        `fadroma = { version = "0.8.7", features = ${JSON.stringify(features)} }`,
        `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
      ].join('\n'))

    $(path, 'src')
      .as(OpaqueDirectory)
      .make()

    $(path, 'src/lib.rs')
      .as(TextFile)
      .save([
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

export class CrateProject extends CargoProject {
  cargoToml = $(this.root, 'Cargo.toml')
    .as(TOMLFile)
  srcDir = $(this.root, 'lib')
    .as(TOMLFile)

  logStatus () {
    return super.logStatus().br()
      .info('This project contains a single source crate:')
      .warn('TODO')
  }

  static async create ({ // do not convert to arrow function
    tools = new Tools.SystemTools(), name, root
  }: {
    tools?: Tools.SystemTools, name?: string, root?: string|Path
  }) {
    const project = await super.create({ tools, name, root }) as CrateProject
    this.writeCrate(root, name)
    return project
  }
}

export class WorkspaceProject extends CargoProject {
  cargoToml = $(this.root, 'Cargo.toml')
    .as(TOMLFile)
  contractsDir = $(this.root, 'contracts')
    .as(OpaqueDirectory)
  librariesDir = $(this.root, 'libraries')
    .as(OpaqueDirectory)

  logStatus () {
    return console.br()
      .info('This project contains the following source crates:')
      .warn('TODO')
  }

  static async create ({ // do not convert to arrow function
    tools = new Tools.SystemTools(), name, root
  }: {
    tools?: Tools.SystemTools, name?: string, root?: string|Path
  }) {
    const project = await super.create(tools, name, root) as Project
    return project
  }

  static writeCrates ({ cargoToml, wasmDir, crates }: {
    cargoToml: Path,
    wasmDir: Path,
    crates: Record<string, any>
  }) {
    // Populate root Cargo.toml
    cargoToml.as(TextFile).save([
      `[workspace]`, `resolver = "2"`, `members = [`,
      Object.values(crates).map(crate=>`  "src/${crate.name}"`).sort().join(',\n'),
      `]`
    ].join('\n'))
    // Create each crate and store a null checksum for it
    const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    for (const crate of Object.values(crates)) {
      crate.create()
      const name = `${crate.name}@HEAD.wasm`
      $(wasmDir, `${name}.sha256`)
        .as(TextFile)
        .save(`${sha256}  *${name}`)
    }
  }
}

export async function selectDeployment (
  cwd: string|Path, name?: string, store: string|DeployStore = Stores.getDeployStore()
): Promise<Deployment> {
  if (typeof store === 'string') {
    store = Stores.getDeployStore(store)
  }
  if (!name) {
    if (process.stdout.isTTY) {
      name = await Prompts.askDeployment(store)
    } else {
      throw new Error('pass deployment name')
    }
  }
  const state = store.get(name!)
  if (!state) {
    throw new Error(`no deployment ${name} in store`)
  }
  return Deployment.fromReceipt(state)
}

export function exportDeployment (
  cwd: string|Path, deployment?: Deployment, path?: string|Path
) {
  if (!deployment) {
    throw new Error("deployment not found")
  }
  if (!path) {
    path = process.cwd()
  }
  // If passed a directory, generate file name
  let file = $(path)
  if (file.isDirectory()) {
    file = file.in(`${name}_@_${timestamp()}.json`)
  }
  // Serialize and write the deployment.
  const state = deployment.toReceipt()
  file.as(JSONFile).makeParent().save(state)
  console.info(
    'saved',
    Object.keys(state).length,
    'contracts to',
    bold(file.shortPath)
  )
}
