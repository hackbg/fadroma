import Project from './Project'
import $, { Path } from '@hackbg/file'
import { bold, colors } from '@hackbg/logs'
import { execSync } from 'node:child_process'
import prompts from 'prompts'
const { text, select } = prompts.prompts

export async function projectWizard () {
  const name = await askProjectName()
  Project.create(name, await askSubdirectory(name), await askContracts(name))
}

export async function askProjectName (): Promise<string> {
  return (await prompts.prompt({
    type: 'text',
    name: 'value',
    message: 'Enter a project name (a-z, 0-9, dash, underscore)'
  })).value
}

export async function askSubdirectory (name: string): Promise<string> {
  const cwd = $(process.cwd())
  return (await prompts.prompt({
    type: 'select',
    name: 'value',
    message: `Create project ${name} in current directory or subdirectory?`,
    choices: [
      { title: `Current directory (${cwd.name})`, value: cwd },
      { title: `Subdirectory (${cwd.name}/${name})`, value: cwd.in(name) }
    ]
  })).value
}

export function askContracts (name: string): {} {
  let contracts = {}
  let action = askContractAction()
  while (action !== 'done') {
    listContracts(contracts)
    switch (action) {
      case 'add':
        defineContract()
        break
      case 'del':
        undefineContract()
        break
      case 'rename':
        renameContract()
        break
    }
    action = askContractAction()
  }
  return contracts
}

export function listContracts (contracts: {}) {
  console.log(contracts)
}

export function askContractAction (): 'done'|'add'|'del'|'rename' {
  return 'done'
}

export function defineContract () {
}

export function undefineContract () {
}

export function renameContract () {
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

