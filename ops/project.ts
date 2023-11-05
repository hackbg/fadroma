/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Error,
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
import {
  askProjectName,
  askProjectRoot,
  askCompiler,
  logInstallRust,
  logInstallSha256Sum,
  logInstallWasmOpt,
} from './prompts'
import * as Tools from './tools'
import { execSync } from 'node:child_process'
import Case from 'case'

export async function projectWizard (options?: {
  tools?:          Tools.SystemTools,
  interactive?:    boolean,
  name?:           string,
  root?:           string|Path|Promise<string|Path>|undefined,
  cargoWorkspace?: boolean,
  cargoCrate?:     string,
  libFeatures?:    string[],
}) {
  const tools = options?.tools || new Tools.SystemTools()
  const interactive = options?.interactive ?? tools.interactive
  // 1st question: project name (required).
  const name = options?.name || await Promise.resolve(
    interactive ? askProjectName() : undefined
  )
  if (!name) {
    throw new Error('missing project name')
  }
  // 2nd question: project directory (defaults to subdir of current dir)
  let root = options?.root || await Promise.resolve(
    interactive ? askProjectRoot(name) : undefined
  )
  if (!root) {
    root = $(tools.cwd, name as string)
  }
  root = $(await Promise.resolve(root)).as(OpaqueDirectory)

  console.log(`Creating project`, bold(name), `in`, bold(root.path))

  // Create generic Project instance
  let project = new Project(name, root.make())
    .createGitRepo()
    .writePlatformManifests()
    .writeApplicationTemplate()
    .runNPMInstall(tools)

  if (options?.cargoWorkspace && options?.cargoCrate) {
    throw new Error('specify either cargoWorkspace or cargoCrate')
  }

  if (options?.cargoWorkspace || options?.cargoCrate) {
    if (options.cargoWorkspace) {
      project = project.writeCargoWorkspace(
        options.cargoWorkspace
      )
    } else if (options?.cargoCrate) {
      project = project.writeCargoCrate(
        options.cargoCrate, options.libFeatures
      )
    }
    if (interactive) {
      switch (await askCompiler(options?.tools)) {
        case 'podman':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_PODMAN=1`)
          break
        case 'raw':
          project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_RAW=1`)
          break
      }
    }
    logInstallRust(tools)
    logInstallSha256Sum(tools)
    logInstallWasmOpt(tools)
    Tools.gitCommit(project.root.path, '"Updated lockfiles."')
  }

  return project
}

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
}

export class Project extends ProjectRoot {
  readonly stateDir     = $(this.root, 'state').as(OpaqueDirectory)
  readonly wasmDir      = $(this.root, 'wasm').as(OpaqueDirectory)
  readonly envFile      = $(this.root, '.env').as(TextFile)
  readonly gitIgnore    = $(this.root, '.gitignore').as(TextFile)
  readonly packageJson  = $(this.root, 'package.json').as(JSONFile)
  readonly readme       = $(this.root, 'README.md').as(TextFile)
  readonly shellNix     = $(this.root, 'shell.nix').as(TextFile)
  readonly apiIndex     = $(this.root, 'index.ts').as(TextFile)
  readonly projectIndex = $(this.root, 'fadroma.config.ts').as(TextFile)
  readonly testIndex    = $(this.root, 'test.ts').as(TextFile)

  writePlatformManifests () {
    this.readme.save(Tools.generateReadme(this.name))
    this.packageJson.save(Tools.generatePackageJson(this.name))
    this.gitIgnore.save(Tools.generateGitIgnore())
    this.envFile.save(Tools.generateEnvFile())
    this.shellNix.save(Tools.generateShellNix(this.name))
    return this
  }

  writeApplicationTemplate () {
    this.apiIndex.save(Tools.generateApiIndex(this.name, {}))
    this.projectIndex.save(Tools.generateProjectIndex(this.name))
    this.testIndex.save(Tools.generateTestIndex(this.name))
    return this
  }

  runNPMInstall (tools: Tools.SystemTools) {
    Tools.runNPMInstall(this, tools)
    return this
  }

  writeCargoCrate (): CargoCrateProject {
    return new CargoCrateProject(this.name, this.root)
  }

  writeCargoWorkspace (): CargoWorkspaceProject {
    return new CargoWorkspaceProject(this.name, this.root)
  }

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
  readonly cargoToml = $(this.root, 'Cargo.toml').as(TOMLFile)

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
}

/** Project that consists of scripts plus a single crate. */
export class CargoCrateProject extends CargoProject {
  logStatus () {
    return super.logStatus().br()
      .info('This project contains a single source crate:')
      .warn('TODO')
  }
}

/** Project that consists of scripts plus multiple crates in a Cargo workspace. */
export class CargoWorkspaceProject extends CargoProject {
  /** The root file of the workspace */
  readonly cargoToml = $(this.root, 'Cargo.toml').as(TOMLFile)
  /** Directory where deployable crates live. */
  readonly contractsDir = $(this.root, 'contracts').as(OpaqueDirectory)
  /** Directory where non-deployable crates live. */
  readonly librariesDir = $(this.root, 'libraries').as(OpaqueDirectory)

  logStatus () {
    return super.logStatus().br()
      .info('This project contains the following source crates:')
      .warn('TODO')
      .info('This project contains the following library crates:')
      .warn('TODO')
  }
}


function writeCrates ({ cargoToml, wasmDir, crates }: {
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
