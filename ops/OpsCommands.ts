import Error from './OpsError'
import Console, { bold } from './OpsConsole'
import Config from './OpsConfig'
import Project from './Project'

import { getBuilder } from './build/index'

import type { Chain, ChainId, DeploymentState, DeployStore } from '@fadroma/agent'
import { Deployment } from '@fadroma/agent'

import $, { JSONFile } from '@hackbg/file'
import { CommandContext } from '@hackbg/cmds'

export default class FadromaCommands extends CommandContext {

  constructor (
    readonly project:    Project|null         = Project.load(),
    readonly deployment: Deployment|undefined = project?.getCurrentDeployment(),
  ) {
    super()
    const devnetCommands =
      new DevnetCommands() as unknown as CommandContext
    const projectCommands =
      new ProjectCommands(project) as unknown as CommandContext
    this
      .addCommand('run', 'execute a script', this.runScript)
      .addCommands('devnet', 'manage local development containers', devnetCommands)
      .addCommands('project', 'manage projects', projectCommands)
    if (this.project) {
      const templateCommands =
        new TemplateCommands(this.project) as unknown as CommandContext
      const deploymentCommands =
        new DeploymentCommands(this.project, deployment) as unknown as CommandContext
      this
        .addCommands('template', 'manage contract templates in current project', templateCommands)
        .addCommand('build', 'build the project or specific contracts from it', this.build)
        .addCommand('upload', 'upload the project or specific contracts from it', this.upload)
        .addCommands('deployment', 'manage deployments of current project', deploymentCommands)
      if (this.deployment) {
        const commands =
          new ContractCommands(this.project, deployment) as unknown as CommandContext
        this.addCommands('contracts', 'manage contracts in current deployment', commands)
      }
    }
  }

  runScript = (script: string, ...args: string[]) => {
    throw new Error('not implemented')
  }

  build = (...contracts: string[]) => {
    if (!this.project) throw new Error('No project')
    if (contracts.length === 0) {
      return this.project.buildAll()
    } else {
      return this.project.build(contracts)
    }
  }

  upload = (...contracts: string[]) => {
    if (!this.project) throw new Error('No project')
    if (contracts.length === 0) {
      return this.project.uploadAll()
    } else {
      return this.project.upload(contracts)
    }
  }


}

export class BuildCommands extends CommandContext {
  constructor () {
    super()
  }
}

export class DeployCommands extends CommandContext {

  constructor (
    readonly chainId?: ChainId,
    readonly store: DeployStore = new Config().getDeployStore(),
  ) {
    super()
    if (chainId) {
      this.addCommand('list',   `list all deployments on ${chainId}`,          this.list)
      this.addCommand('create', `create a new empty deployment in ${chainId}`, this.create)
      this.addCommand('select', `activate another deployment on ${chainId}`,   this.select)
      this.addCommand('status', `show status of active deployment`,            this.status)
      this.addCommand('export', `export current deployment to ${name}.json`,   this.export)
    }
  }

  log = new Console.Deploy(`@fadroma/ops`)

  list = () => this.log.deploymentList(this.chainId??'(unspecified)', this.store)

  create = async (name: string) => this.store.create(name).then(()=>this.select(name))

  select = async (name?: string): Promise<DeploymentState|null> => {
    const list = this.store.list()
    if (list.length < 1) throw new Error('No deployments in this store')
    let deployment
    if (name) {
      deployment = await this.store.select(name)
    } else if (this.store.active) {
      deployment = this.store.active
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
    return deployment || null
  }

  status = (name?: string) => {
    const deployment = name ? this.store.save(name) : this.store.active
    if (deployment) {
      this.log.deployment(deployment as any)
    } else {
      throw new Error.Deploy.NoDeployment()
    }
  }

  export = async (path?: string) => {
    const deployment = this.store.active
    if (!deployment) throw new Error.Deploy.NoDeployment()
    const state: Record<string, any> = JSON.parse(JSON.stringify(deployment.state))
    for (const [name, contract] of Object.entries(state)) {
      delete contract.workspace
      delete contract.artifact
      delete contract.log
      delete contract.initMsg
      delete contract.builderId
      delete contract.uploaderId
    }
    const file = $(path??'')
      .at(`${deployment.name}.json`)
      .as(JSONFile<typeof state>)
    file.save(state)
    this.log.info('Wrote', Object.keys(state).length, 'contracts to', bold(file.shortPath))
  }

}

export class DevnetCommands extends CommandContext {

  constructor (public chain?: Chain) {
    super('Fadroma Devnet')

    //// Define CLI commands
    //this.addCommand('reset',  'kill and erase the devnet', () => {})
    //this.addCommand('stop',   'gracefully pause the devnet', () => {})
    //this.addCommand('kill',   'terminate the devnet immediately', () => {})
    //this.addCommand('export', 'stop the devnet and save it as a new Docker image', () => {})
  }

  status = this.command('status', 'print the status of the current devnet', () => {
    const { chain } = this
    if (!chain) {
      this.log.info('No active chain.')
    } else {
      this.log.info('Chain type: ', bold(chain.constructor.name))
      this.log.info('Chain mode: ', bold(chain.mode))
      this.log.info('Chain ID:   ', bold(chain.id))
      this.log.info('Chain URL:  ', bold(chain.url.toString()))
    }
    return this
  })

  reset = this.command('reset', 'erase the current devnet', async (chain = this.chain) => {
    if (!chain) {
      this.log.info('No active chain.')
    } else if (!chain.isDevnet || !chain.node) {
      this.log.error('This command is only valid for devnets.')
    } else {
      await chain.node.terminate()
    }
  })

}

export class ProjectCommands extends CommandContext {
  constructor (readonly project: Project|null) { super() }
  create = this.command('create', 'create a new project', (name?: string) => Project.create({ name }))
}

export class TemplateCommands extends CommandContext {
  constructor (readonly project: Project) { super() }
  add = this.command('add', 'add a new contract template to the project',
    () => { throw new Error('not implemented') })
  list = this.command('list', 'list contract templates defined in this project',
    () => { throw new Error('not implemented') })
  del = this.command('del', 'delete a contract template from this project',
    () => { throw new Error('not implemented') })
}

export class DeploymentCommands extends CommandContext {
  constructor (
    readonly project:    Project|null         = Project.load(),
    readonly deployment: Deployment|undefined = project?.getCurrentDeployment(),
  ) {
    super()
  }
}

export class ContractCommands extends CommandContext {
  constructor (
    readonly project:    Project|null         = Project.load(),
    readonly deployment: Deployment|undefined = project?.getCurrentDeployment(),
  ) {
    super()
  }
}
