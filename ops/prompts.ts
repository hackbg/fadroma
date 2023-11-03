/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with tools program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Class, DeployStore, UploadedCode } from '@fadroma/connect'
import type { Project } from './project'
import { SystemTools, NOT_INSTALLED } from './tools'
import { Console, bold, colors, Scrt } from '@fadroma/connect'
import $, { Path, OpaqueDirectory, TextFile } from '@hackbg/file'
import prompts from 'prompts'
import * as dotenv from 'dotenv'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { console } from './config'

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

export function logNonFatal (nonfatal?: boolean) {
  if (nonfatal) {
    console.warn('One or more convenience operations failed.')
    console.warn('You can retry them manually later.')
  }
}

export async function logProjectCreated ({ root }: Project) {

  console.log("Project created at", bold(root.shortPath))
    .info()
    .info(`To compile your contracts:`)
    .info(`  $ ${bold('npm run build')}`)
    .info(`To spin up a local deployment:`)
    .info(`  $ ${bold('npm run devnet deploy')}`)
    .info(`To deploy to testnet:`)
    .info(`  $ ${bold('npm run testnet deploy')}`)

  const envFile = root.at('.env').as(TextFile).load()

  const { FADROMA_TESTNET_MNEMONIC: mnemonic } = dotenv.parse(envFile)

  console.info(`Your testnet mnemonic:`)
    .info(`  ${bold(mnemonic)}`)

  const testnetAgent = await Scrt.testnet().authenticate({ mnemonic })

  Object.assign(testnetAgent, { log: { log () {} } })

  console.info(`Your testnet address:`)
    .info(`  ${bold(testnetAgent.address)}`)
    .info(`Fund your testnet wallet at:`)
    .info(`  ${bold('https://faucet.pulsar.scrttestnet.com')}`)

}

export async function askDeployment (store: DeployStore & {
  root?: Path
}): Promise<string|undefined> {
  const label = store.root
    ? `Select a deployment from ${store.root.shortPath}:`
    : `Select a deployment:`
  return await askSelect(label, [
    [...store.keys()].map(title=>({ title, value: title })),
    { title: '(cancel)', value: undefined }
  ])
}
