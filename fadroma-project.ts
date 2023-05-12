import { Config, Console, colors, Error, DeployError } from './fadroma-base'
import { getBuilder, ContractCrate } from './fadroma-build'
import { getUploader } from './fadroma-upload'
import { Devnet } from './fadroma-devnet'

import type {
  Builder, Buildable, Built, Uploader, Chain,
  CodeId, CodeHash, ChainId, Uploadable, Uploaded,
  DeploymentClass, DeployStoreClass,
} from '@fadroma/agent'
import {
  Deployment, DeployStore,
  Agent, AnyContract, Contract, Client, DeploymentState, Template,
  toInstanceReceipt, timestamp, bold
} from '@fadroma/agent'

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
      fadromaJson:    this.root.at('fadroma.json').as(JSONFile),
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
  rebuild = async (...names: string[]): Promise<Built[]> => {
    throw new Error.Unimplemented('rebuild')
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
  reupload = async (...names: string[]): Promise<Built[]> => {
    throw new Error.Unimplemented('rebuild')
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
    const { name, templates, root, dirs, files, crates } = this
    root.make()
    Object.values(this.dirs).forEach(dir=>dir.make())
    const {
      readme, packageJson, cargoToml,
      gitignore, envfile, shellNix,
      fadromaJson, apiIndex, opsIndex, testIndex,
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
      `import { getDeployment } from '@hackbg/fadroma`,
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
  runScript = (script?: string, ...args: string[]) => {
    if (!script) throw new Error(`Usage: fadroma run SCRIPT [...ARGS]`)
    if (!$(script).exists()) throw new Error(`${script} doesn't exist`)
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
}

/** Interactive project creation CLI.
  * TODO: single crate option
  * TODO: `shared` crate option */
export class ProjectWizard {

  cwd: string = process.cwd()

  tools: ReturnType<typeof toolVersions> = toolVersions()

  interactive: boolean = !!process.stdin.isTTY && process.stdout.isTTY

  constructor (options: Partial<ProjectWizard> = {}) {
    this.cwd         = options.cwd ?? this.cwd
    this.tools       = options.tools ?? this.tools
    this.interactive = options.interactive ?? this.interactive
  }

  async createProject (...args: any[]): Promise<Project> {
    let { git, pnpm, yarn, npm, cargo, docker, podman } = this.tools
    const name = this.interactive
      ? await this.askName()
      : args[0]
    const root = (this.interactive
      ? $(await this.askRoot(name))
      : $(this.cwd, name)).as(OpaqueDirectory)
    const templates = this.interactive
      ? await this.askTemplates(name)
      : args.slice(1).reduce((templates, crate)=>Object.assign(templates, { [crate]: crate }), {})
    const project = new Project({ name, root, templates: templates as any }).create()
    if (this.interactive) {
      switch (await this.selectBuilder()) {
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
        project.npmInstall(this.tools)
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
  selectBuilder (): 'podman'|'raw'|any {
    const { cargo = 'not installed', docker = 'not installed', podman = 'not installed' } = this.tools
    const buildRaw    = { value: 'raw',    title: `No, build with local toolchain (${cargo})` }
    const buildDocker = { value: 'docker', title: `Yes, build in a Docker container (${docker})` }
    const buildPodman = { value: 'podman', title: `Yes, build in a Podman container (${podman})` }
    const hasPodman = podman && (podman !== 'not installed')
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

export async function askUntilDone <S> (
  state: S, selector: (state: S)=>Promise<Function|null>|Function|null
) {
  let action = null
  while (typeof (action = await Promise.resolve(selector(state))) === 'function') {
    await Promise.resolve(action(state))
  }
  return state
}

export const toolVersions = () => {
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
