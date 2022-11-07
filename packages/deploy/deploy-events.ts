import type { Deployment, DeployStore } from '@fadroma/core'
import { ConnectConsole, ConnectError } from '@fadroma/connect'
import $ from '@hackbg/kabinet'
import { bold, colors } from '@hackbg/konzola'

export class DeployConsole extends ConnectConsole {
  constructor (public name = 'Fadroma Deploy') { super(name) }
  warnNoDeployment () {
    return this.warn(
      'No active deployment. Most commands will fail. ' +
      'You can create a deployment using `fadroma-deploy new` ' +
      'or select a deployment using `fadroma-deploy select` ' +
      'among the ones listed by `fadroma-deploy list`.'
    )
  }
  warnNoAgent (name?: string) {
    return this.warn(
      'No agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.'
    )
  }
  warnNoDeployAgent () {
    return this.warn('No deploy agent. Deployments will not be possible.')
  }
  deployment (deployment: Deployment, name = deployment.name) {
    name ??= $(deployment.name).shortPath
    super.deployment(deployment, name)
  }
  deploymentList (chainId: string, deployments: DeployStore) {
    const list = deployments.list()
    if (list.length > 0) {
      this.info(`Deployments on chain ${bold(chainId)}:`)
      let maxLength = 0
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        maxLength = Math.max(name.length, maxLength)
      }
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        const deployment = deployments.get(name)!
        const count = Object.keys(deployment.state).length
        let info = `${bold(name.padEnd(maxLength))}`
        info = `${info} (${deployment.size} contracts)`
        if (deployments.active && deployments.active.name === name) {
          info = `${info} ${bold('selected')}`
        }
        this.info(` `, info)
      }
    } else {
      this.info(`No deployments on chain ${bold(chainId)}`)
    }
    this.br()
  }
  deployStoreDoesNotExist (path: string) {
    log.warn(`Deployment store "${path}" does not exist.`)
  }
  saving (name: string, state: object) {
    //this.log.log('Saving:  ', bold(name))
    //this.log.log(Object.keys(state).join(', '))
    //this.log.br()
  }
  creatingDeployment (name: string) {
    this.log('Creating:', bold(name))
  }
  locationOfDeployment (path: string) {
    this.log('Location:', bold(path))
  }
  activatingDeployment (name: string) {
    this.log('Activate:', bold(name))
  }
  warnOverridingStore (self: string) {
    this.warn(`Overriding store for ${self}`)
  }
}

export const log = new DeployConsole('Fadroma Deploy')

export class DeployError extends ConnectError {
  static DeploymentAlreadyExists = this.define(
    'DeploymentAlreadyExists',
    (name: string)=>`Deployment "${name}" already exists`
  )
  static DeploymentDoesNotExist = this.define(
    'DeploymentDoesNotExist',
    (name: string)=>`Deployment "${name}" does not exist`
  )
}
