import { Console, bold, colors } from '@fadroma/connect'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { cwd } from 'node:process'
import Case from 'case'
import $, { Path, TextFile, JSONFile, TOMLFile, Directory } from '@hackbg/file'
import { console } from './config'
import type { Project } from './project'

export const NOT_INSTALLED = 'not installed'

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

export function createGitRepo (cwd: string, tools: SystemTools): {
  nonfatal: boolean
} {
  let nonfatal = false
  return { nonfatal }
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
        runShellCommands(project.root.path, ['pnpm i'])
      } else if (yarn) {
        runShellCommands(project.root.path, ['yarn'])
      } else {
        runShellCommands(project.root.path, ['npm i'])
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
