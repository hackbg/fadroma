import Project from './Project'
import $, { Path } from '@hackbg/file'
import { Console, bold, colors } from '@hackbg/logs'
import { execSync } from 'node:child_process'
import prompts from 'prompts'
const { text, select } = prompts.prompts

const console = new Console('@fadroma/project')

export async function projectWizard () {
  const name = await askProjectName()
  const root = await askSubdirectory(name)
  const contracts = await askContracts(name)
  Project.create(name, root, contracts)
  console.log("Initializing project:")
  run(root.path, 'git init')
  run(root.path, 'pnpm i')
  run(root.path, 'cargo doc --all-features')
  run(root.path, 'git add .')
  run(root.path, 'git status')
  run(root.path, 'git commit -m "Created by @fadroma/project 1.0.0 (https://fadroma.tech)"')
  console.br()
  console.log("Project initialized.")
  console.info(`View documentation at ${root.in('target').in('doc').in(name).at('index.html').url}`)
}

export function run (cwd: string, cmd: string) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

export async function askProjectName (): Promise<string> {
  return (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a project name (a-z, 0-9, dash/underscore)'
  })).value
}

export async function askSubdirectory (name: string): Promise<Path> {
  const cwd = $(process.cwd())
  return (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Create project ${name} in current directory or subdirectory?`,
    choices: [
      { title: `Subdirectory (${cwd.name}/${name})`, value: cwd.in(name) },
      { title: `Current directory (${cwd.name})`, value: cwd },
    ]
  })).value
}

export async function askContracts (name: string): Promise<{}> {
  let contracts = {}
  let action = await askContractAction(name, contracts)
  while (typeof action === 'function') {
    await Promise.resolve(action(contracts))
    action = await askContractAction(name, contracts)
  }
  return contracts
}

export async function askContractAction (
  name: string,
  contracts: Record<string, any>
): Promise<Function|null> {
  return (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Project ${name} contains ${Object.keys(contracts).length} contract(s): ${Object.keys(contracts).join(', ')}`,
    choices: [
      { title: `Add contract`,    value: defineContract },
      { title: `Remove contract`, value: undefineContract },
      { title: `Rename contract`, value: renameContract },
      { title: `(done)`,          value: null },
    ]
  })).value
}

export async function defineContract (contracts: Record<string, any>) {
  const name = (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a name for the new contract (a-z, 0-9, dash/underscore):'
  })).value
  contracts[name] = {}
}

export async function undefineContract (contracts: Record<string, any>) {
  const name = (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Select contract to remove from project scope:`,
    choices: [
      ...Object.keys(contracts).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })).value
  delete contracts[name]
}

export async function renameContract (contracts: Record<string, any>) {
  const contract = (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Select contract to rename:`,
    choices: [
      ...Object.keys(contracts).map(contract=>({ title: contract, value: contract })),
      { title: `(done)`, value: null },
    ]
  })).value
  const name = (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: `Enter a new name for ${contract} (a-z, 0-9, dash/underscore):`
  })).value
  contracts[name] = contracts[contract]
  delete contracts[contract]
}

export function askDonation () {
}

export function isGitRepo () {
}

export function checkSystemDependencies () {
  //console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  checkSystemDependency('Git:    ', 'git --version')
  checkSystemDependency('Node:   ', 'node --version')
  checkSystemDependency('NPM:    ', 'npm --version')
  checkSystemDependency('Yarn:   ', 'yarn --version')
  checkSystemDependency('PNPM:   ', 'pnpm --version')
  checkSystemDependency('Cargo:  ', 'cargo --version')
  checkSystemDependency('Docker: ', 'docker --version')
  checkSystemDependency('Nix:    ', 'nix --version')
}

export function checkSystemDependency (dependency: string, command: string) {
  let version = null
  try {
    const version = execSync(command)
    console.log(' ', bold(dependency), String(version).trim())
  } catch (e) {
    console.log(' ', bold(dependency), colors.yellow('(not found)'))
  } finally {
    return version
  }
}

