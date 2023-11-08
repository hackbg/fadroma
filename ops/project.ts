/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error, Deployment, bold, timestamp } from '@fadroma/connect'
import type { Agent, ChainId, ContractCode } from '@fadroma/connect'
import $, { Directory, TextFile, TOMLFile, JSONFile } from '@hackbg/file'
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

export function getProject (
  root: string|Path = process.env.FADROMA_PROJECT || process.cwd()
) {
  root = $(root)
  if (!root.isDirectory()) {
    throw new Error(`${root.path} is not a directory`)
  }
  const project = new Project(root)
  const { packageJson } = project
  if (project.packageJson.isFile()) {
    project.name = project.packageJson.load().name
  }
  return project
}

export async function createProject (options?: {
  tools?:          Tools.SystemTools,
  interactive?:    boolean,
  name?:           string,
  root?:           string|Path|Promise<string|Path>|undefined,
  cargoWorkspace?: boolean,
  cargoCrate?:     string,
  libFeatures?:    string[],
}) {
  const tools =
    options?.tools || new Tools.SystemTools()
  const interactive =
    options?.interactive ?? tools.interactive
  // 1st question: project name (required).
  const name =
    options?.name || await Promise.resolve(interactive ? askProjectName() : undefined)
  if (!name) {
    throw new Error('missing project name')
  }
  // 2nd question: project directory (defaults to subdir of current dir)
  let root =
    options?.root || await Promise.resolve(interactive ? askProjectRoot(name) : undefined)
  if (!root) {
    root = $(tools.cwd, name as string)
  }
  root = $(await Promise.resolve(root)).as(Directory)

  console.log(`Creating project`, bold(name), `in`, bold(root.path))

  // Create generic Project instance
  let project = new Project(root.make(), name)
    .createGitRepo()
    .writePlatformManifests()
    .writeApplicationTemplate()
    .runNPMInstall(tools)

  console.log({options})

  //if (options?.cargoWorkspace && options?.cargoCrate) {
    //throw new Error('specify either cargoWorkspace or cargoCrate')
  //}

  //if (options?.cargoWorkspace || options?.cargoCrate) {
    //if (options.cargoWorkspace) {
      //project = project.writeCargoWorkspace({
        //root
      //})
    //} else if (options?.cargoCrate) {
      //project = project.writeCargoCrate({
        //root,
        //cargoCrate: options.cargoCrate,
        //features:   options?.libFeatures
      //})
    //}
    //if (interactive) {
      //switch (await askCompiler(options?.tools)) {
        //case 'podman':
          //project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_PODMAN=1`)
          //break
        //case 'raw':
          //project.envFile.save(`${project.envFile.load()}\nFADROMA_BUILD_RAW=1`)
          //break
      //}
    //}
    //logInstallRust(tools)
    //logInstallSha256Sum(tools)
    //logInstallWasmOpt(tools)
    //Tools.gitCommit(project.root.path, '"Updated lockfiles."')
  //}

  return project
}

class ProjectDirectory {
  root: Path
  get path (): string {
    return this.root.path
  }
  constructor (root: string|Path) {
    if (!root) {
      throw new Error('missing project root directory')
    }
    this.root = $(root)
  }
}

export class Project extends ProjectDirectory {
  constructor (root: string|Path, public name?: string) {
    super(root)
  }

  readonly stateDir    = this.root.in('state')
  readonly wasmDir     = this.root.in('wasm')
  readonly envFile     = this.root.at('.env').as(TextFile)
  readonly gitIgnore   = this.root.at('.gitignore').as(TextFile)
  readonly packageJson = this.root.at('package.json').as(JSONFile<{ name?: string }>)
  readonly readme      = this.root.at('README.md').as(TextFile)
  readonly shellNix    = this.root.at('shell.nix').as(TextFile)
  readonly main        = this.root.at('index.ts').as(TextFile)
  readonly cargoToml   = this.root.at('Cargo.toml').as(TOMLFile)

  readonly cargoCrates: Record<string, {
    name: string, dependencies?: Record<string, { version: string, features?: string[] }>
  }> = {}

  createGitRepo () {
    Tools.runShellCommands(this.path, ['git --no-pager init -b main',])
    this.gitIgnore.save(Tools.generateGitIgnore())
    Tools.runShellCommands(this.path, [
      'git --no-pager add .',
      'git --no-pager status',
      'git --no-pager commit -m "Project created by @hackbg/fadroma (https://fadroma.tech)"',
      "git --no-pager log",
    ])
    return this
  }
  writePlatformManifests () {
    if (!this.name) {
      throw new Error("can't write nameless project")
    }
    this.readme.save(Tools.generateReadme(this.name))
    this.packageJson.save(Tools.generatePackageJson(this.name))
    this.gitIgnore.save(Tools.generateGitIgnore())
    this.envFile.save(Tools.generateEnvFile())
    this.shellNix.save(Tools.generateShellNix(this.name))
    return this
  }
  writeApplicationTemplate () {
    if (!this.name) {
      throw new Error("can't write nameless project")
    }
    this.main.save(Tools.generateApiIndex(this.name, {}))
    //this.projectIndex.save(Tools.generateProjectIndex(this.name))
    //this.testIndex.save(Tools.generateTestIndex(this.name))
    return this
  }
  runNPMInstall (tools: Tools.SystemTools) {
    Tools.runNPMInstall(this, tools)
    return this
  }
  //writeCargoCrate ({
    //root       = this.path,
    //cargoCrate = '',
    //features   = [] as string[]
  //}): CargoCrateProject {
    //return new CargoCrateProject(this.path, this.name)
  //}
  //writeCargoWorkspace ({
    //root = this.path
  //}: { root: string|Path }): CargoWorkspaceProject {
    //return new CargoWorkspaceProject(this.path, this.name)
  //}
  async logStatus () {
    console.br()
      .info('Project name:   ', bold(this.name||'(unnamed project)'))
      .info('Project root:   ', bold(this.path))
      .info('Binaries:       ', bold(this.wasmDir.path))
      .info('Deploy state:   ', bold(this.stateDir.path))
    let deployment
    try {
      deployment = await this.getDeployment()
      for (const [name, unit] of deployment) {
        console.info('Deployment unit:', bold(name))
        if (unit.source?.canCompile) {
          console.info('  Source code:  ', unit.source[Symbol.toStringTag])
        }
        if (unit.compiled?.canUpload) {
          console.info('  Compiled code:', unit.compiled[Symbol.toStringTag])
        }
        if (unit.uploaded?.canInstantiate) {
          console.info('  Uploaded code:', unit.uploaded[Symbol.toStringTag])
        }
      }
    } catch (e) {
      console.br().info('No deployment.')
    }
    return console
  }
  createDeployment (): Deployment {
    console.warn('createDeployment: not implemented')
    return new Deployment()
  }
  async getDeployment (): Promise<Deployment> {
    const {default: deployment} = await import(this.path)
    return deployment()
  }
  cargoUpdate () {
    Tools.runShellCommands(this.path, ['cargo update'])
    return this
  }
}

class CargoCrate extends ProjectDirectory {
  name: string
  features?: string[]
  cargoToml = this.root.at('Cargo.toml').as(TextFile)
  main = this.root.in('src').at('lib.rs').as(TextFile)
  constructor (root: string|Path, { name, features }: {
    name: string,
    features?: string[]
  }) {
    super(root)
    this.name = name
    this.features = features
  }
  write (name: string, features: string) {
    this.cargoToml.save(Tools.generateCargoToml(this.name, this.features))
    this.main.save(Tools.generateContractEntrypoint())
  }
}

class CargoWorkspace extends ProjectDirectory {
  crates: Record<string, CargoCrate> = {}
  cargoToml = this.root.at('Cargo.toml').as(TextFile)
  constructor (root: string|Path, { name, crates = {} }: {
    name: string,
    crates?: Record<string, CargoCrate>
  }) {
    super(root)
    this.crates = crates
  }
}

/** Project that consists of scripts plus multiple crates in a Cargo workspace. */
export class CargoWorkspaceProject extends Project {
  /** The root file of the workspace */
  readonly cargoToml = $(this.root, 'Cargo.toml').as(TOMLFile)
  /** Directory where deployable crates live. */
  readonly contractsDir = $(this.root, 'contracts').as(Directory)
  /** Directory where non-deployable crates live. */
  readonly librariesDir = $(this.root, 'libraries').as(Directory)
}
