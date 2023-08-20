/**

  Fadroma
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import type {
  ChainRegistry, ChainClass, DeploymentClass, Builder, Buildable, Built,
  Uploader, Uploadable, Uploaded, CodeId, CodeHash, ChainId, DeployStoreClass,
} from './fadroma'
import Config, { version } from './fadroma-config'
import { ContractCrate } from './fadroma-build'
import { Devnet } from './fadroma-devnet'
import { ProjectWizard, toolVersions } from './fadroma-wizard'

import {
  Chain, ChainMode, Scrt, Deployment, DeployStore,
  Agent, AnyContract, Contract, Client, DeploymentState, Template,
  toInstanceReceipt, timestamp, bold, Console, Error,
  bip39, bip39EN
} from '@fadroma/connect'


import * as Dock from '@hackbg/dock'
import { CommandContext } from '@hackbg/cmds'
import $, {
  Path, YAMLDirectory, YAMLFile, TextFile, OpaqueDirectory,
  OpaqueFile, TOMLFile, JSONFile, JSONDirectory
} from '@hackbg/file'

import Case from 'case'
import prompts from 'prompts'

import { basename } from 'node:path'
import { execSync } from 'node:child_process'

/** @returns Builder configured as per environment and options */
export function getBuilder (options: Partial<Config["build"]> = {}): Builder {
  return new Config({ build: options }).getBuilder()
}

/** Compile a single contract with default settings. */
export async function build (source: Buildable): Promise<Built> {
  return getBuilder().build(source)
}

/** Compile multiple single contracts with default settings. */
export async function buildMany (sources: Buildable[]): Promise<Built[]> {
  return getBuilder().buildMany(sources)
}

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<Config["upload"]> = {}): Uploader {
  return new Config({ upload: options }).getUploader()
}

/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<(Uploaded|null)[]> {
  return getUploader().uploadMany(artifacts)
}

/** @returns Deployment configured according to environment and options */
export function getDeployment <D extends Deployment> (
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
  ...args: ConstructorParameters<typeof $D>
): D {
  return new Config().getDeployment($D, ...args)
}

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<Config["devnet"]> = {}) {
  return new Config({ devnet: options }).getDevnet()
}

// This installs devnet as a selectable chain:
Chain.variants['ScrtDevnet'] =
  (options: Partial<Devnet> = { platform: 'scrt_1.9' }): Scrt.Chain =>
    new Config().getDevnet(options).getChain(Scrt.Chain as ChainClass<Scrt.Chain>)

const console = new Console(`@hackbg/fadroma ${version}`)

export default class Project extends CommandContext {
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

  static wizard = (...args: any[]) => new ProjectWizard().createProject(this, ...args)

  static load = (path: string|OpaqueDirectory = process.cwd()): Project|null => {
    const configFile = $(path, 'fadroma.yml').as(YAMLFile)
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
    const root = $(options?.root || this.config.root || process.cwd()).as(OpaqueDirectory)
    const name = options?.name || root.name
    this.name = name
    this.root = root
    this.log.label = this.exists() ? name : `@hackbg/fadroma ${version}`
    if (this.exists()) this.log.info('at', bold(this.root.path))
    if (this.exists()) this.log.info(`on`, bold(this.config.chainId))
    this.builder = getBuilder({ outputDir: this.dirs.wasm.path })
    const uploadState = this.config.chainId ? this.dirs.state.in(this.config.chainId).path : null
    this.uploader = getUploader({ uploadState })

    // Populate templates
    this.templates = {}
    const templates = options?.templates || (this.exists()
      ? ((this.files.fadromaYaml.load()||{}) as any).templates||{}
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
    this.command('rebuild',  'rebuild the project or specific contracts from it',
                 this.rebuild)
    this.command('upload',   'upload the project or specific contracts from it',
                 this.upload)
    this.command('reupload', 'reupload the project or specific contracts from it',
                 this.reupload)
    this.command('deploy',   'deploy this project or continue an interrupted deployment',
                 this.deploy)
    this.command('redeploy', 'redeploy this project from scratch',
                 this.redeploy)
    this.command('select',   `activate another deployment on ${this.config.chainId}`,
                 this.selectDeployment)
    this.command('export',   `export current deployment to ${name}.json`,
                 this.exportDeployment)
    this.command('reset',    'stop and erase running devnets',
                 this.resetDevnets)
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
      apiIndex:       this.root.at('api.ts').as(TextFile),
      opsIndex:       this.root.at('ops.ts').as(TextFile),
      testIndex:      this.root.at('tes.ts').as(TextFile),
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
  /** @returns the active deployment */
  get deployment () {
    return this.getDeployment()
  }
  /** The deploy receipt store implementation selected by `format`. */
  get DeployStore (): DeployStoreClass<DeployStore> {
    const variant = DeployStore.variants[this.config.deploy.format]
    if (!variant) throw new Error.Missing.DeployFormat()
    return variant
  }
  /** @returns an up-to-date DeployStore */
  get deployStore () {
    return new (this.DeployStore)(this.config.deploy.storePath)
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
    toolVersions()
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

  /** @returns Boolean whether the project (as defined by fadroma.yml in root) exists */
  exists = () =>
    this.files.fadromaYaml.exists()
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
  rebuild = async (...names: string[]): Promise<Built[]> => {
    this.builder.caching = false
    return this.build(...names)
  }
  /** Uploads one or more named templates, or all templates if no arguments are passed.
    * Builds templates with missing artifacts if sources are available. */
  upload = async (...names: string[]): Promise<(Uploaded|null)[]> => {
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
    const templates = this.builder ? await this.builder.buildMany(sources) : sources
    return await this.uploader.uploadMany(templates as Uploadable[])
  }
  reupload = async (...names: string[]): Promise<(Uploaded|null)[]> => {
    this.uploader.reupload = true
    return this.upload(...names)
  }
  deploy = async (...args: string[]) => {
    const deployment: Deployment = this.deployment || await this.createDeployment()
    this.log.info(`deployment:`, bold(deployment.name), `(${deployment.constructor?.name})`)
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
  getDeployment = (name?: string, contracts: Record<string, Partial<AnyContract>> = {}): InstanceType<typeof this.Deployment> => {
    return this.config.getDeployment(this.Deployment, {
      agent:     this.uploader.agent ??= this.config.getAgent(),
      chain:     this.uploader.agent.chain,
      builder:   this.builder,
      uploader:  this.uploader,
      workspace: this.root.path,
      store:     this.deployStore,
      contracts
    })
  }
  listDeployments = () =>
    this.log.deploy.deploymentList(this.config.chainId??'(unspecified)', this.deployStore)
  createDeployment = (name: string = timestamp()) =>
    this.deployStore.create(name).then(()=>this.selectDeployment(name))
  selectDeployment = async (name?: string): Promise<Deployment> => {
    const store = this.deployStore
    if (store.list().length < 1) throw new Error('No deployments in this store')
    let deployment: Deployment
    if (name) {
      return this.getDeployment(name, { contracts: await store.select(name) })
    } else if (process.stdout.isTTY) {
      name = await ProjectWizard.selectDeploymentFromStore(store)
      if (name) {
        return this.getDeployment(name, { contracts: await store.select(name) })
      } else {
        throw new Error(`No such deployment: ${name}`)
      }
    } else if (store.activeName) {
      return this.getDeployment(store.activeName, await store.load(store.activeName)!)
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
  }
  exportDeployment = async (path?: string) => {
    const store = this.deployStore
    const name = this.deployStore.activeName
    if (!name) throw new Error.Missing.Deployment()
    const state = store.load(name)
    if (!state) throw new Error.Missing.Deployment()
    const deployment = this.deployment
    if (!deployment) throw new Error.Missing.Deployment()
    if (!path) path = process.cwd()
    // If passed a directory, generate file name
    let file = $(path)
    if (file.isDirectory()) file = file.in(`${name}_@_${timestamp()}.json`)
    // Serialize and write the deployment.
    file.as(JSONFile).makeParent().save(deployment.snapshot)
    this.log.info('saved', Object.keys(state).length, 'contracts to', bold(file.shortPath))
  }
  resetDevnets = async (...ids: ChainId[]) =>
    Devnet.deleteMany(this.root.in('state'), ids)
  /** Write the files representing the described project to the root directory.
    * @returns this */
  create = () => {
    writeProject(this)
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
  /** @returns this */
  gitCommit = (message: string = "") => {
    this.runShellCommands(
      'git --no-pager add .',
      'git --no-pager status',
      `git --no-pager commit -m ${message}`,
    )
    return this
  }
  /** @returns this */
  npmInstall = ({ npm, yarn, pnpm }: any = toolVersions()) => {
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
  /** Run one or more external commands in the project root. */
  runShellCommands = (...cmds: string[]) =>
    cmds.map(cmd=>execSync(cmd, { cwd: this.root.path, stdio: 'inherit' }))
  /** Load and execute the default export of an ES module. */
  runScript = async (script?: string, ...args: string[]) => {
    if (!script) throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
    if (!$(script).exists()) throw new Error(`${script} doesn't exist`)
    this.log.log(`Running ${script}`)
    const path = $(script).path
    //@ts-ignore
    const { default: main } = await import(path)
    if (typeof main === 'function') {
      return main(this, ...args)
    } else {
      this.log.info(`${$(script).shortPath} does not have a default export.`)
    }
  }
}

export * from '@fadroma/connect'

export * from './fadroma-build'
export * from './fadroma-upload'
export * from './fadroma-deploy'
export * from './fadroma-devnet'

export * from './fadroma-config'
export { default as Config } from './fadroma-config'

export function writeProject ({ name, templates, root, dirs, files, crates }: Project) {
  root.make()
  Object.values(dirs).forEach(dir=>dir.make())
  const {
    readme, packageJson, cargoToml,
    gitignore, envfile, shellNix,
    fadromaYaml, apiIndex, opsIndex, testIndex,
  } = files
  readme.save([
    `# ${name}\n---\n`,
    `Powered by [Fadroma](https://fadroma.tech) `,
    `by [Hack.bg](https://hack.bg) `,
    `under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
  ].join(''))
  fadromaYaml.save({ templates })
  packageJson.save({
    name: `${name}`,
    main: `api.ts`,
    type: "module",
    version: "0.1.0",
    dependencies: {
      "@fadroma/agent": "latest",
      "@fadroma/scrt": "latest",
      "secretjs": "1.9.3"
    },
    devDependencies: {
      "@hackbg/fadroma": "latest",
      "@hackbg/ganesha": "latest",
      "typescript": "^5",
    },
    scripts: {
      "build":   "fadroma build",
      "rebuild": "fadroma rebuild",
      "status":  "fadroma status",
      "mocknet": `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=Mocknet fadroma`,
      "devnet":  `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=ScrtDevnet fadroma`,
      "testnet": `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=ScrtTestnet fadroma`,
      "mainnet": `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=ScrtMainnet fadroma`,
      "test":         `FADROMA_PROJECT=./ops.ts fadroma run tes.ts`,
      "test:mocknet": `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=Mocknet fadroma run tes.ts`,
      "test:devnet":  `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=ScrtDevnet fadroma run tes.ts`,
      "test:testnet": `FADROMA_PROJECT=./ops.ts FADROMA_CHAIN=ScrtTestnet fadroma run tes.ts`,
    },
  })
  apiIndex.save([
    `import { Client, Deployment } from '@fadroma/agent'`,
    [
      `export default class ${Case.pascal(name)} extends Deployment {`,
      ...Object.keys(templates).map(name => [
        ``, `  ${name} = this.contract({`,
        `    name: "${name}",`,
        `    crate: "${name}",`,
        `    client: ${Case.pascal(name)},`,
        `    initMsg: async () => ({})`,
        `  })`
      ].join('\n')),
      '',
      `  // Define your contract roles here with:`,
      `  //   contract = this.contract({...})`, `  //`,
      `  // See https://fadroma.tech/deploy.html`,
      `  // for more info about how to populate this section.`,
      '',
      '}',
    ].join('\n'),
    ...Object.keys(templates).map(x=>Case.pascal(x)).map(Contract => [
      `export class ${Contract} extends Client {`,
      `  // Implement methods calling the contract here:`, `  //`,
      `  // myTx = (arg1, arg2) => this.execute({my_tx:{arg1, arg2}})`,
      `  // myQuery = (arg1, arg2) => this.query({my_query:{arg1, arg2}})`, `  //`,
      `  // See https://fadroma.tech/agent.html#client`,
      `  // for more info about how to populate this section.`,
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
  testIndex.save([
    `import * as assert from 'node:assert'`,
    `import ${Case.pascal(name)} from './api'`,
    `import { getDeployment } from '@hackbg/fadroma'`,
    `const deployment = await getDeployment(${Case.pascal(name)}).deploy()`,
    `// add your assertions here`
  ].join('\n'))
  gitignore.save([
    '.env',
    'node_modules',
    'target',
    'state/*',
    '!state/secret-1',
    '!state/secret-2',
    '!state/secret-3',
    '!state/secret-4',
    '!state/pulsar-1',
    '!state/pulsar-2',
    'wasm/*',
    '!wasm/*.sha256',
  ].join('\n'))
  envfile.save([
    '# FADROMA_MNEMONIC=your mainnet mnemonic',
    `FADROMA_TESTNET_MNEMONIC=${bip39.generateMnemonic(bip39EN)}`
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
    Object.values(crates).map(crate=>`  "src/${crate.name}"`).sort().join(',\n'),
    `]`
  ].join('\n'))
  const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
  Object.values(crates).forEach(crate=>{
    crate.create()
    const name = `${crate.name}@HEAD.wasm`
    dirs.wasm.at(`${name}.sha256`).as(TextFile).save(`${sha256}  *${name}`)
  })
}
