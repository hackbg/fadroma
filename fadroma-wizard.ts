/**

  Fadroma Wizards
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

import type Project from './fadroma'
import type { Class, Template, Buildable, DeployStore, Built } from './fadroma'
import { version } from './fadroma-config'

import { Console, bold, colors } from '@fadroma/connect'

import $, { Path, OpaqueDirectory } from '@hackbg/file'
import prompts from 'prompts'

import { execSync } from 'node:child_process'
import { platform } from 'node:os'

const console = new Console(`@hackbg/fadroma ${version}`)

/** Interactive project creation CLI.
  * TODO: single crate option
  * TODO: `shared` crate option */
export class ProjectWizard {

  log = new Console(`@hackbg/fadroma ${version}`)

  cwd: string = process.cwd()

  tools: ReturnType<typeof toolVersions> = toolVersions()

  interactive: boolean = !!process.stdin.isTTY && process.stdout.isTTY

  constructor (options: Partial<ProjectWizard> = {}) {
    this.cwd         = options.cwd ?? this.cwd
    this.tools       = options.tools ?? this.tools
    this.interactive = options.interactive ?? this.interactive
  }

  async createProject (_P: typeof Project, ...args: any[]): Promise<Project> {
    let { git, pnpm, yarn, npm, cargo, docker, podman } = this.tools
    const name = args[0] ?? (this.interactive ? await this.askName() : undefined)
    if (name === 'undefined') throw new Error('missing project name')
    console.log(`Creating project`, name)
    const root = (this.interactive
      ? $(await this.askRoot(name))
      : $(this.cwd, name)).as(OpaqueDirectory)
    console.log(`Creating in`, root.shortPath)
    const templates = args.slice(1).length > 0
      ? args.slice(1).reduce((templates, crate)=>Object.assign(templates, { [crate]: crate }), {})
      : this.interactive
        ? await this.askTemplates(name)
        : {}
    console.log(`Defining`, Object.keys(templates).length, `template(s) in project`)
    const options = { name, root, templates: templates as any }
    const project = new _P(options)
    project.create()
    if (this.interactive) {
      switch (await this.selectBuilder()) {
        case 'podman': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_PODMAN=1`); break
        case 'raw': project.files.envfile.save(`${project.files.envfile.load()}\nFADROMA_BUILD_RAW=1`); break
        default: break
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
    const cwd    = $(process.cwd()).as(OpaqueDirectory)
    const exists = cwd.in(name).exists()
    const empty  = (cwd.list()?.length||0) === 0
    const inSub  = `Subdirectory (${exists?'overwrite: ':''}${cwd.name}/${name})`
    const inCwd  = `Current directory (${cwd.name})`
    const choice = [
      { title: inSub, value: cwd.in(name) },
      { title: inCwd, value: cwd },
    ]
    if (empty) choice.reverse()
    return askSelect(`Create project ${name} in current directory or subdirectory?`, choice)
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
      if (name === null) return
      delete state[name]
    }
    async function renameContract (state: Record<string, any>) {
      const name = await askSelect(`Select contract to rename:`, [
        ...Object.keys(state).map(contract=>({ title: contract, value: contract })),
        { title: `(done)`, value: null },
      ])
      if (name === null) return
      const newName = await askText(`Enter a new name for ${name} (a-z, 0-9, dash/underscore):`)
      if (newName) {
        state[newName] = Object.assign(state[name], { name: newName })
        delete state[name]
      }
    }
  }
  selectBuilder (): 'podman'|'raw'|any {
    const { cargo = 'not installed', docker = 'not installed', podman = 'not installed' } = this.tools
    const buildRaw    = { value: 'raw',    title: `No isolation, build with local toolchain (${cargo||'cargo: not found!'})` }
    const buildDocker = { value: 'docker', title: `Perform builds in a Docker container (${docker||'docker: not found!'})` }
    const buildPodman = { value: 'podman', title: `Perform builds in a Podman container (experimental; ${podman||'podman: not found!'})` }
    const hasPodman = podman && (podman !== 'not installed')
    const engines = hasPodman ? [ buildPodman, buildDocker ] : [ buildDocker, buildPodman ]
    const isLinux = platform() === 'linux'
    const choices = isLinux ? [ ...engines, buildRaw ] : [ buildRaw, ...engines ]
    return askSelect(`Select build isolation mode:`, choices)
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
