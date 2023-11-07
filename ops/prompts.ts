/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with tools program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Class, DeployStore, UploadedCode } from '@fadroma/connect'
import type { Project } from './project'
import { NOT_INSTALLED, SystemTools } from './tools'
import { Console, bold, colors, Scrt } from '@fadroma/connect'
import $, { Path, Directory, TextFile } from '@hackbg/file'
import Prompts from 'prompts'
import * as dotenv from 'dotenv'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { console } from './config'

export async function askText <T> ({
  prompts = Prompts,
  message,
  valid = (x: string) => clean(x).length > 0,
  clean = (x: string) => x.trim()
}: {
  prompts?: { prompt: typeof Prompts["prompt"] },
  message: string,
  valid?: (x: string) => boolean,
  clean?: (x: string) => string,
}): Promise<string> {
  while (true) {
    const input = await prompts.prompt({ type: 'text', name: 'value', message })
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

export async function askSelect <T> ({ prompts = Prompts, message, choices }: {
  prompts?: { prompt: typeof Prompts["prompt"] },
  message: string,
  choices: any[]
}) {
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

export async function askDeployment (store: DeployStore & {
  root?: Path
}): Promise<string|undefined> {
  const label = store.root
    ? `Select a deployment from ${store.root.shortPath}:`
    : `Select a deployment:`
  return await askSelect({ prompts: Prompts, message: label, choices: [
    [...store.keys()].map(title=>({ title, value: title })),
    { title: '(cancel)', value: undefined }
  ]})
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
  console.log("Project created at", bold(root.shortPath)).info()
    .info(`To compile your contracts:`).info(`  $ ${bold('npm run build')}`)
    .info(`To spin up a local deployment:`).info(`  $ ${bold('npm run devnet deploy')}`)
    .info(`To deploy to testnet:`).info(`  $ ${bold('npm run testnet deploy')}`)
}

export async function askProjectName (): Promise<string> {
  let value
  do {
    value = await askText({
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

export async function askProjectRoot (name: string|Promise<string>|undefined): Promise<Path> {
  name =
    await Promise.resolve(name) as string
  const cwd =
    $(process.cwd()).as(Directory)
  const exists =
    cwd.in(name).exists()
  const inSub =
    `Subdirectory (${exists?'overwrite: ':''}${cwd.basename}/${name})`
  const inCwd =
    `Current directory (${cwd.basename})`
  const choices = [
    { title: inSub, value: cwd.in(name) },
    { title: inCwd, value: cwd },
  ]
  if ((cwd.list()?.length||0) === 0) {
    choices.reverse()
  }
  const message = `Create project ${name} in current directory or subdirectory?`
  return askSelect({ message, choices })
}

export async function askTemplates (name: string): Promise<Record<string, Partial<UploadedCode>>> {
  return askUntilDone({}, (state) => askSelect({
    message: [
      `Project ${name} contains ${Object.keys(state).length} contract(s):\n`,
      `  ${Object.keys(state).join(',\n  ')}`
    ].join(''),
    choices: [
      { title: `Add contract template to the project`, value: defineContract },
      { title: `Remove contract template`, value: undefineContract },
      { title: `Rename contract template`, value: renameContract },
      { title: `(done)`, value: null },
    ]
  }))
}

export async function defineContract (state: Record<string, any>) {
  let crate
  crate = await askText({
    message: 'Enter a name for the new contract (lowercase a-z, 0-9, dash, underscore):'
  })??''
  if (!isNaN(crate[0] as any)) {
    console.info('Contract name cannot start with a digit.')
    crate = ''
  }
  if (crate) {
    state[crate] = { crate }
  }
}

export async function undefineContract (state: Record<string, any>) {
  const name = await askSelect({
    message: `Select contract to remove from project scope:`,
    choices: [
      ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })
  if (name === null) return
  delete state[name]
}

export async function renameContract (state: Record<string, any>) {
  const name = await askSelect({
    message: `Select contract to rename:`,
    choices: [
      ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })
  if (name === null) return
  const newName = await askText({
    message: `Enter a new name for ${name} (a-z, 0-9, dash/underscore):`
  })
  if (newName) {
    state[newName] = Object.assign(state[name], { name: newName })
    delete state[name]
  }
}

export async function askCompiler ({
  isLinux,
  cargo  = NOT_INSTALLED,
  docker = NOT_INSTALLED,
  podman = NOT_INSTALLED
}: Partial<SystemTools> = {}, prompts: { prompt: typeof Prompts["prompt"] } = Prompts): Promise<'raw'|'docker'|'podman'> {
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
  return await askSelect({
    prompts,
    message: `Select build isolation mode:`,
    choices: isLinux ? [ ...engines, buildRaw ] : [ buildRaw, ...engines ]
  })
}
