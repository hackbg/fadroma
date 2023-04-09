import DeployConfig from './DeployConfig'
import Error from './DeployError'
import Console, { bold } from './DeployConsole'
import type { Deployment, DeploymentState, DeployStore } from '@fadroma/agent'

import { CommandContext } from '@hackbg/cmds'
import $, { JSONFile } from '@hackbg/file'

export default class DeployCommands extends CommandContext {

  constructor (
    public config: DeployConfig = new DeployConfig(),
    public store:  DeployStore  = config.getDeployStore(),
  ) {
    super()
    const { chain } = config
    if (chain) {
      this.addCommand('list',   `list all deployments on ${chain}`,          this.list.bind(this))
      this.addCommand('create', `create a new empty deployment in ${chain}`, this.create.bind(this))
      this.addCommand('select', `activate another deployment on ${chain}`,   this.select.bind(this))
      this.addCommand('status', `show status of active deployment`,          this.status.bind(this))
      this.addCommand('export', `export current deployment to ${name}.json`, this.export.bind(this))
    }
  }

  log = new Console(`@fadroma/ops`)

  list () {
    this.log.deploymentList(
      this.config.chain??'(unspecified)',
      this.store
    )
  }

  async create (name: string) {
    await this.store.create(name)
    return await this.select(name)
  }

  async select (name?: string): Promise<DeploymentState|null> {
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

  status (name?: string) {
    const deployment = name ? this.store.save(name) : this.store.active
    if (deployment) {
      this.log.deployment(deployment as any)
    } else {
      throw new Error.NoDeployment()
    }
  }

  async export (path?: string) {
    const deployment = this.store.active
    if (!deployment) throw new Error.NoDeployment()

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
