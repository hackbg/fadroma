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
  static async create (properties: Partial<{
    tools?:Tools.SystemTools,
    interactive?: boolean,
    name?: string,
    root?: string|Path|Promise<string|Path>|undefined,
  }> = {}) {
    const tools =
      properties.tools || new Tools.SystemTools()
    const interactive =
      properties.interactive || tools.interactive
    const name =
      properties.name || await Promise.resolve(interactive ? this.askName() : undefined)
    if (!name) {
      throw new Error('missing project name')
    }
    let root =
      properties.root || await Promise.resolve(interactive ? this.askRoot(name) : undefined)
    if (!root) {
      root = $(tools.cwd, name as string)
    }
    root = $(await Promise.resolve(root)).as(OpaqueDirectory)
    console.log(`Creating project`, bold(name), `in`, bold(root.path))
    return new this(name!, root.make())
      .createGitRepo()
  }

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

  createGitRepo () {
    Tools.runShellCommands(this.root.path, ['git --no-pager init -b main',])
    $(this.root, '.gitignore').as(TextFile).save(Tools.generateGitIgnore())
    Tools.runShellCommands(this.root.path, [
      'git --no-pager add .',
      'git --no-pager status',
      'git --no-pager commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git --no-pager log",
    ])
    return this
  }

  static async askName (): Promise<string> {
    let value
    do {
      value = await Prompts.askText({
        message: 'Enter a project name (a-z, 0-9, dash/underscore)'
      })??''
      value = value.trim()
      if (!isNaN(value[0] as any)) {
        console.info('Project name cannot start with a digit.')
        value = ''
      }
    } while (value === '')
    return value
  }

  static async askRoot (name: string|Promise<string>|undefined): Promise<Path> {
    name =
      await Promise.resolve(name) as string
    const cwd =
      $(process.cwd()).as(OpaqueDirectory)
    const exists =
      cwd.in(name).exists()
    const inSub =
      `Subdirectory (${exists?'overwrite: ':''}${cwd.name}/${name})`
    const inCwd =
      `Current directory (${cwd.name})`
    const choices = [
      { title: inSub, value: cwd.in(name) },
      { title: inCwd, value: cwd },
    ]
    if ((cwd.list()?.length||0) === 0) {
      choices.reverse()
    }
    const message = `Create project ${name} in current directory or subdirectory?`
    return Prompts.askSelect({ message, choices })
  }
}

export class Project extends ProjectRoot {
  stateDir     = $(this.root, 'state').as(OpaqueDirectory)
  wasmDir      = $(this.root, 'wasm').as(OpaqueDirectory)
  envFile      = $(this.root, '.env').as(TextFile)
  gitIgnore    = $(this.root, '.gitignore').as(TextFile)
  packageJson  = $(this.root, 'package.json').as(JSONFile)
  readme       = $(this.root, 'README.md').as(TextFile)
  shellNix     = $(this.root, 'shell.nix').as(TextFile)
  apiIndex     = $(this.root, 'index.ts').as(TextFile)
  projectIndex = $(this.root, 'fadroma.config.ts').as(TextFile)
  testIndex    = $(this.root, 'test.ts').as(TextFile)

  logStatus () {
    return super.logStatus().br()
      .info('Project state: ', bold(this.stateDir.shortPath))
      .info('Build results: ', bold(this.wasmDir.shortPath))
      .br().info('Deployment units: ')
      .warn('(TODO)')
  }

  createDeployment (): Deployment {
    console.warn('createDeployment: not implemented')
    return new Deployment()
  }

  getDeployment (): Deployment {
    console.warn('getDeployment: not implemented')
    return new Deployment()
  }

  // warning: do not convert static create methods
  // to arrow functions or inheritance will break
  static async create (properties: Parameters<typeof ProjectRoot["create"]>[0] = {}) {
    properties.tools ??= new Tools.SystemTools()
    properties.interactive ??= properties.tools.interactive
    const project = await super.create(properties) as Project
    properties.name ??= await Promise.resolve(properties.interactive ? this.askName() : undefined)
    if (!properties.name) {
      throw new Error("missing project name")
    }
    project.readme.save(Tools.generateReadme(properties.name))
    project.packageJson.save(Tools.generatePackageJson(properties.name))
    project.gitIgnore.save(Tools.generateGitIgnore())
    project.envFile.save(Tools.generateEnvFile())
    project.shellNix.save(Tools.generateShellNix(properties.name))
    project.apiIndex.save(Tools.generateApiIndex(properties.name, {}))
    project.projectIndex.save(Tools.generateProjectIndex(properties.name))
    project.testIndex.save(Tools.generateTestIndex(properties.name))
    Tools.runNPMInstall(project, properties.tools)
    return project
  }
  static async askTemplates (name: string): Promise<Record<string, Partial<UploadedCode>>> {
    return Prompts.askUntilDone({}, (state) => Prompts.askSelect([
      `Project ${name} contains ${Object.keys(state).length} contract(s):\n`,
      `  ${Object.keys(state).join(',\n  ')}`
    ].join(''), [
      { title: `Add contract template to the project`, value: this.defineContract },
      { title: `Remove contract template`, value: this.undefineContract },
      { title: `Rename contract template`, value: this.renameContract },
      { title: `(done)`, value: null },
    ]))
  }
  protected static async defineContract (state: Record<string, any>) {
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
  protected static async undefineContract (state: Record<string, any>) {
    const name = await Prompts.askSelect(`Select contract to remove from project scope:`, [
      ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ])
    if (name === null) return
    delete state[name]
  }
  protected static async renameContract (state: Record<string, any>) {
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

/** A NPM-only project that contains only scripts, no Rust crates. */
export class ScriptProject extends Project {
  logStatus () {
    return super.logStatus().br()
      .info('This project contains no crates.')
  }
}

/** Base class for project that contains a Cargo crate or workspace. */
export class CargoProject extends Project {
  cargoToml = $(this.root, 'Cargo.toml').as(TOMLFile)

  cargoUpdate () {
    Tools.runShellCommands(this.root.path, ['cargo update'])
    return this
  }

  writeContractCrate ({ path = '.', name, features = [] }: {
    name: string, features?: string[], path?: string
  }) {
    $(this.root, path, 'Cargo.toml').as(TextFile).save(Tools.generateCargoToml(name, features))
    $(this.root, path, 'src').as(OpaqueDirectory).make()
    $(this.root, path, 'src/lib.rs').as(TextFile).save(Tools.generateContractEntrypoint())
    return this
  }

  static async create (properties: Parameters<typeof ProjectRoot["create"]>[0] = {}) {
    properties.tools ??= new Tools.SystemTools()
    properties.interactive ??= properties.tools.interactive
    const project = await super.create(properties) as CargoProject
    if (properties.interactive) {
      switch (await this.askCompiler(properties?.tools)) {
        case 'podman':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_PODMAN=1`)
          break
        case 'raw':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_RAW=1`)
          break
      }
    }
    Prompts.logInstallRust(properties.tools)
    Prompts.logInstallSha256Sum(properties.tools)
    Prompts.logInstallWasmOpt(properties.tools)
    Tools.gitCommit(project.root.path, '"Updated lockfiles."')
    return project
  }
  static async askCompiler ({
    isLinux,
    cargo  = Tools.NOT_INSTALLED,
    docker = Tools.NOT_INSTALLED,
    podman = Tools.NOT_INSTALLED
  }: Partial<Tools.SystemTools>): Promise<'raw'|'docker'|'podman'> {
    const variant = (value: string, title: string) => ({ value, title })
    const buildRaw = variant(
      'raw', `No isolation, build with local toolchain (${cargo||'cargo: not found!'})`
    )
    const buildDocker = variant(
      'docker', `Isolate builds in a Docker container (${docker||'docker: not found!'})`
    )
    /* TODO: podman is currently disabled
    const buildPodman = variant('podman',
      `Isolate builds in a Podman container (experimental; ${podman||'podman: not found!'})`)
    const hasPodman = podman && (podman !== NOT_INSTALLED)
     const engines = hasPodman ? [ buildPodman, buildDocker ] : [ buildDocker, buildPodman ] */
    const engines = [ buildDocker ]
    return await Prompts.askSelect({
      message: `Select build isolation mode:`,
      choices: isLinux ? [ ...engines, buildRaw ] : [ buildRaw, ...engines ]
    })
  }
}

/** Project that consists of scripts plus a single crate. */
export class CrateProject extends CargoProject {

  logStatus () {
    return super.logStatus().br()
      .info('This project contains a single source crate:')
      .warn('TODO')
  }

  /** Create a project, writing a single crate. */
  static async create (properties: Parameters<typeof ProjectRoot["create"]>[0] & Partial<{
    features?: string[]
  }> = {}) {
    return (await super.create(properties) as CrateProject)
      .writeContractCrate({
        path: '.',
        name: properties?.name || 'untitled',
        features: properties?.features || []
      })
      .cargoUpdate()
  }

}

/** Project that consists of scripts plus multiple crates in a Cargo workspace. */
export class WorkspaceProject extends CargoProject {

  /** The root file of the workspace */
  cargoToml = $(this.root, 'Cargo.toml').as(TOMLFile)
  /** Directory where deployable crates live. */
  contractsDir = $(this.root, 'contracts').as(OpaqueDirectory)
  /** Directory where non-deployable crates live. */
  librariesDir = $(this.root, 'libraries').as(OpaqueDirectory)

  logStatus () {
    return super.logStatus().br()
      .info('This project contains the following source crates:')
      .warn('TODO')
      .info('This project contains the following library crates:')
      .warn('TODO')
  }

  static async create (properties: Parameters<typeof ProjectRoot["create"]>[0] = {}) {
    const project = await super.create(properties) as Project
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
