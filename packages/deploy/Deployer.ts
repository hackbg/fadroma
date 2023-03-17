import Error from './DeployError'
import Console, { bold } from './DeployConsole'
import Config from './DeployConfig'
import type { Deployment, DeployStore as Store } from '@fadroma/core'

import $, { JSONFile, Path } from '@hackbg/file'
import { CommandContext } from '@hackbg/cmds'

export default class Deployer<D extends Deployment> extends CommandContext {

  constructor (
    public deployment: D,
    public config:     Config = new Config(),
    public store:      Store = config.getDeployStore(),
    public name:       string = '',
  ) {
    super('')
    deployment.chain ??= config.getChain()
    if (deployment.chain) {
      const chain = deployment.chain.id
      this.addCommand('list',   `list all deployments on ${chain}`,          this.list.bind(this))
      this.addCommand('create', `create a new empty deployment in ${chain}`, this.create.bind(this))
      this.addCommand('select', `activate another deployment on ${chain}`,   this.select.bind(this))
      this.addCommand('status', `show status of active deployment`,          this.status.bind(this))
      this.addCommand('export', `export current deployment to ${name}.json`, this.export.bind(this))
    }
  }

  log = new Console(`@fadroma/deploy`)

  list () {
    this.log.deploymentList(
      this.deployment.chain?.id??'(unspecified)',
      this.store
    )
  }

  async create (name: string) {
    await this.store.create(name)
    return await this.select(name)
  }

  async select (name?: string): Promise<Deployment|null> {
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
    const deployment = name ? this.store.get(name) : this.store.active
    if (deployment) {
      this.log.deployment(deployment)
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

    this.log.br()
  }

  /** Path to root of project directory. */
  get project (): Path|undefined {
    if (typeof this.config.project !== 'string') {
      return undefined
    }
    return $(this.config.project)
  }

  /** Save current deployment state to deploy store. */
  async save () {
    if (this.deployment.chain && !this.deployment.chain.isMocknet) {
      this.log.saving(this.name, this.deployment.state)
      this.store.set(this.name, this.deployment.state)
    }
  }

  async deploy (deployment: D) {}

}
