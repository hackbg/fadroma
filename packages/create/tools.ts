import { Core, Deploy, Store } from '@fadroma/agent'
import { SyncFS, FileFormat } from '@hackbg/file'
import type { Path } from '@hackbg/file'

import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { cwd } from 'node:process'
import Case from 'case'
import Prompts from 'prompts'
import * as dotenv from 'dotenv'

import { console } from './package'
import type { Project } from './create'

export const NOT_INSTALLED = 'not installed'

const { bold, colors } = Core

export class SystemTools {
  constructor (readonly verbose: boolean = true) {}

  /** Check and report a variable */
  protected check <T> (name: string|null, value: T): T {
    if (name) {
      console.info(bold(name), value)
    }
    return value
  }

  /** Check and report if an external binary is available. */
  protected checkTool (dependency: string|null, command: string): string|null {
    let version = null
    try {
      version = String(execSync(command)).trim().split('\n')[0]
      if (this.verbose && dependency) {
        console.info(bold(dependency), version)
      }
    } catch (e) {
      if (this.verbose && dependency) {
        console.warn(bold(dependency), colors.yellow('(not found)'))
      }
    } finally {
      return version
    }
  }

  cwd         = cwd()
  isLinux     = platform() === 'linux'
  isMac       = platform() === 'darwin'
  isWin       = platform() === 'win32'
  ttyIn       = this.check('TTY in:  ', !!process.stdin.isTTY)
  ttyOut      = this.check('TTY out: ', !!process.stdout.isTTY)
  interactive = this.ttyIn && this.ttyOut
  git         = this.checkTool('Git      ', 'git --no-pager --version')
  node        = this.checkTool('Node     ', 'node --version')
  npm         = this.checkTool('NPM      ', 'npm --version')
  yarn        = this.checkTool('Yarn     ', 'yarn --version')
  pnpm        = this.checkTool('PNPM     ', 'pnpm --version')
  corepack    = this.checkTool('corepack ', 'corepack --version')
  cargo       = this.checkTool('Cargo    ', 'cargo --version')
  rust        = this.checkTool('Rust     ', 'rustc --version')
  sha256sum   = this.checkTool('sha256sum', 'sha256sum --version')
  wasmOpt     = this.checkTool('wasm-opt ', 'wasm-opt --version')
  docker      = this.checkTool('Docker   ', 'docker --version')
  podman      = this.checkTool('Podman   ', 'podman --version')
  nix         = this.checkTool('Nix      ', 'nix --version')
  secretcli   = this.checkTool('secretcli', 'secretcli version')
  homebrew    = this.isMac ? this.checkTool('homebrew ', 'brew --version') : undefined
}

/** Run one or more external commands in the project root. */
export function runShellCommands (cwd: string, cmds: string[]) {
  return cmds.map(cmd=>execSync(cmd, { cwd, stdio: 'inherit' }))
}

export function runNPMInstall (project: Project, tools: SystemTools): {
  changed?:  true
  nonfatal?: true
} {
  let changed:  true|undefined = undefined
  let nonfatal: true|undefined = undefined
  const { pnpm, yarn, npm, corepack } = tools
  if (pnpm || yarn || npm) {
    if (!pnpm && corepack) {
      console.info('Try PNPM! To enable it, just run:')
      console.info('  $ corepack enable')
    }
    try {
      if (pnpm) {
        runShellCommands(project.root.absolute, ['pnpm i'])
      } else if (yarn) {
        runShellCommands(project.root.absolute, ['yarn'])
      } else {
        runShellCommands(project.root.absolute, ['npm i'])
      }
    } catch (e) {
      console.warn('Non-fatal: NPM install failed:', e)
      nonfatal = true
    }
    changed = true 
  } else {
    console.warn('NPM/Yarn/PNPM not found. Not creating lockfile.')
  }
  return { changed, nonfatal }
}

export function gitCommit (cwd: string, message: string) {
  if (!message) {
    throw new Error("specify commit message")
  }
  return runShellCommands(cwd, [
    'git --no-pager add .',
    'git --no-pager status',
    `git --no-pager commit -m ${message}`,
  ])
}

export function generateApiIndex (name: string, crates: {}) {
  const deploymentClassName =
    (Object.keys(crates).includes(name))
      ? `${Case.pascal(name)}Deployment`
      : Case.pascal(name)
  const lines = [
    `import { Deployment } from '@hackbg/fadroma'`,
    `export default (state) => new Deployment(state)`
  ]
  for (const [name, crate] of Object.entries(crates)) {
    lines.push(
      `  .addContract('${name}', { language: 'rust' })`
    )
  }
  return [
    `import { Deployment } from '@hackbg/fadroma'`,
    [
      `export default (state) => new Deployment(state)`,
      ...Object.keys(crates).map(name => [
        ``, `.addContract('${name}', {`,
        `    crate: "${name}",`,
        `    client: ${Case.pascal(name)},`,
        `    initMsg: async () => ({})`,
        `  })`
      ].join('\n')),
    ].join('\n'),
  ].join('\n\n')
}

export function generateProjectIndex (name: string) {
  return [
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
  ].join('\n\n')
}

export function generateTestIndex (name: string) {
  return [
    `import * as assert from 'node:assert'`,
    `import ${Case.pascal(name)} from './api'`,
    `import { getDeployment } from '@hackbg/fadroma'`,
    `const deployment = await getDeployment(${Case.pascal(name)}).deploy()`,
    `// add your assertions here`
  ].join('\n')
}

export function generateReadme (name: string) {
  return [
    `# ${name}\n---\n`,
    `Powered by [Fadroma](https://fadroma.tech) `,
    `as provided by [Hack.bg](https://hack.bg) `,
    `under [AGPL3](https://www.gnu.org/licenses/agpl-3.0.en.html).`
  ].join('\n')
}

export function generateCargoToml (name: string, features: string[] = []) {
  return [
    `[package]`, `name = "${name}"`, `version = "0.0.0"`, `edition = "2021"`,
    `authors = []`, `keywords = ["fadroma"]`, `description = ""`, `readme = "README.md"`, ``,
    `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
    `[dependencies]`,
    `fadroma = { version = "0.8.7", features = ${JSON.stringify(features)} }`,
    `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
  ].join('\n')
}

export function generateContractEntrypoint () {
  return [
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
  ].join('\n')
}

export function writeCrates ({ cargoToml, wasmDir, crates }: {
  cargoToml: Path,
  wasmDir: Path,
  crates: Record<string, any>
}) {
  // Populate root Cargo.toml
  new SyncFS.File(cargoToml).save([
    `[workspace]`, `resolver = "2"`, `members = [`,
    Object.values(crates).map(crate=>`  "src/${crate.name}"`).sort().join(',\n'),
    `]`
  ].join('\n'))
  // Create each crate and store a null checksum for it
  const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
  for (const crate of Object.values(crates)) {
    crate.create()
    const name = `${crate.name}@HEAD.wasm`
    new SyncFS.File(wasmDir, `${name}.sha256`).save(
      `${sha256}  *${name}`
    )
  }
}

export function logInstallRust ({ isMac, homebrew, cargo, rust }: SystemTools) {
  if (!cargo || !rust) {
    console.warn('Tool not available: cargo or rustc.')
    console.warn('Building contract without container will fail.')
    if (isMac && !homebrew) {
      console.info('Install homebrew (https://docs.brew.sh/Installation), then:')
    } else {
      console.info('You can install it with:')
      console.info('  $ brew install rustup')
      console.info('  $ rustup target add wasm32-unknown-unknown')
    }
  }
}

export function logInstallSha256Sum ({ isMac, homebrew, sha256sum }: SystemTools) {
  if (!sha256sum) {
    console.warn('Tool not available: sha256sum. Building contract without container will fail.')
    if (isMac && !homebrew) {
      console.info('Install homebrew (https://docs.brew.sh/Installation), then:')
    } else {
      console.info('You can install it with:')
      console.info('  $ brew install coreutils')
    }
  }
}

export function logInstallWasmOpt ({ isMac, homebrew, wasmOpt }: SystemTools) {
  if (!wasmOpt) {
    console.warn('Tool not available: wasm-opt. Building contract without container will fail.')
    if (isMac && !homebrew) {
      console.info('Install homebrew (https://docs.brew.sh/Installation), then:')
    } else {
      console.info('You can install it with:')
      console.info('  $ brew install binaryen')
    }
  }
}

export async function logProjectCreated ({ root }: { root: Path }) {
  console.log("Project created at", bold(root.short)).info()
    .info(`To compile your contracts:`).info(`  $ ${bold('npm run build')}`)
    .info(`To spin up a local deployment:`).info(`  $ ${bold('npm run devnet deploy')}`)
    .info(`To deploy to testnet:`).info(`  $ ${bold('npm run testnet deploy')}`)
}

export class InputCancelled extends Error {}

const choice = <T>(title: string, value: T) => ({ title, value })

export class Prompter {

  constructor (
    public prompts: { prompt: typeof Prompts["prompt"] } = Prompts,
    public interactive: boolean = true
  ) {}

  async text <T> (message: string, {
    valid = (x: string) => clean(x).length > 0,
    clean = (x: string) => x.trim()
  }: {
    valid?: (x: string) => boolean,
    clean?: (x: string) => string,
  } = {}): Promise<string> {
    while (true) {
      const input = await this.prompts.prompt({
        type: 'text',
        name: 'value',
        message
      })
      if ('value' in input) {
        if (valid(input.value)) {
          return clean(input.value)
        }
      } else {
        console.error('Input cancelled.')
        process.exit(1)
      }
    }
  }

  async select <T> (message: string, choices: T[]) {
    const input = await this.prompts.prompt({
      type: 'select',
      name: 'value',
      message,
      choices
    })
    if ('value' in input) {
      return input.value
    }
    throw new InputCancelled()
    console.error('Input cancelled.')
    process.exit(1)
  }

  async untilDone <S> (
    state: S, selector: (state: S)=>Promise<Function|null>|Function|null
  ) {
    let action = null
    while (typeof (action = await Promise.resolve(selector(state))) === 'function') {
      await Promise.resolve(action(state))
    }
    return state
  }

}

export class ProjectPrompter extends Prompter {

  deployment (store: Store.DeployStore & { root?: Path }): Promise<string|undefined> {
    const label = store.root
      ? `Select a deployment from ${store.root.short}:`
      : `Select a deployment:`
    return this.select(label, [
      [...store.keys()].map(title=>({ title, value: title })),
      { title: '(cancel)', value: undefined }
    ])
  }

  async projectName (): Promise<string> {
    let value
    do {
      value = await this.text('Enter a project name (a-z, 0-9, dash/underscore)')??''
      value = value.trim()
      if (!isNaN(value[0] as any)) {
        console.info('Project name cannot start with a digit.')
        value = ''
      }
    } while (value === '')
    return value
  }

  async projectRoot (name: string|Promise<string>|undefined): Promise<Path> {
    name =
      await Promise.resolve(name) as string
    const cwd =
      new SyncFS.Directory(process.cwd())
    const exists =
      cwd.subdir(name).exists()
    const inSub =
      `Subdirectory (${exists?'overwrite: ':''}${cwd.basename}/${name})`
    const inCwd =
      `Current directory (${cwd.basename})`
    const choices = [
      { title: inSub, value: cwd.subdir(name) },
      { title: inCwd, value: cwd },
    ]
    if ((cwd.list()?.length||0) === 0) {
      choices.reverse()
    }
    return this.select(
      `Create project ${name} in current directory or subdirectory?`,
      choices
    )
  }

  projectMode = (prompts: typeof Prompts = Prompts): Promise<0|1|typeof Infinity> =>
    this.select(`How many crates will this project contain?`, [
      choice('No crates, just scripts.',         0),
      choice('One contract crate plus scripts.', 1),
      choice('One workspace plus scripts.',      Infinity),
    ])

  contractCrates = (name: string): Promise<Record<string, Partial<Deploy.UploadedCode>>> =>
    this.untilDone({}, state => {
      const message = [
        `Project ${name} contains ${Object.keys(state).length} contract(s):\n`,
        `  ${Object.keys(state).join(',\n  ')}`
      ].join('')
      return this.select(message, [
        choice(`Add contract template to the project`, ()=>this.defineContract(state)),
        choice(`Remove contract template`,             ()=>this.undefineContract(state)),
        choice(`Rename contract template`,             ()=>this.renameContract(state)),
        choice(`(done)`,                               null),
      ])
    })

  defineContract = async (state: Record<string, any>) => {
    let crate
    crate = await this.text(
      'Enter a name for the new contract (lowercase a-z, 0-9, dash, underscore):'
    )??''
    if (!isNaN(crate[0] as any)) {
      console.info('Contract name cannot start with a digit.')
      crate = ''
    }
    if (crate) {
      state[crate] = { crate }
    }
  }

  undefineContract = async (state: Record<string, any>) => {
    const name = await this.select(`Select contract to remove from project scope:`, [
      ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ])
    if (name === null) {
      return
    }
    delete state[name]
  }

  renameContract = async (state: Record<string, any>) => {
    const name = await this.select(`Select contract to rename:`, [
      ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ])
    if (name === null) {
      return
    }
    const newName = await this.text(`Enter a new name for ${name} (a-z, 0-9, dash/underscore):`)
    if (newName) {
      state[newName] = Object.assign(state[name], { name: newName })
      delete state[name]
    }
  }

  compileMode = (
    {
      isLinux, cargo  = NOT_INSTALLED, docker = NOT_INSTALLED, podman = NOT_INSTALLED
    }: Partial<SystemTools> = {},
    prompts: {
      prompt: typeof Prompts["prompt"]
    } = Prompts
  ): Promise<'raw'|'docker'|'podman'> => {
    const variant = (value: string, title: string) => ({ value, title })
    /* TODO: podman is currently disabled
    const buildPodman = variant('podman',
      `Isolate builds in a Podman container (experimental; ${podman||'podman: not found!'})`)
    const hasPodman = podman && (podman !== NOT_INSTALLED)
     const engines = hasPodman ? [ buildPodman, buildDocker ] : [ buildDocker, buildPodman ] */
    const engines = [
      variant('docker', `Compile contracts in a local container (${docker||'docker: not found!'})`)
    ]
    const buildRaw = variant(
      'raw', `Compiler contracts with your local toolchain (${cargo||'cargo: not found!'})`
    )
    if (isLinux) {
      engines.push(buildRaw)
    } else {
      engines.unshift(buildRaw)
    }
    return this.select(`Select build isolation mode:`, engines)
  }

}
