import { ConnectConsole, ConnectError } from '@fadroma/connect'
import $ from '@hackbg/kabinet'
import { bold } from '@hackbg/konzola'
import type { Deployment } from '@fadroma/client'
import type { DeployStore } from './deploy-base'

export class DeployConsole extends ConnectConsole {
  deployment ({ deployment }: { deployment: Deployment }) {
    this.br()
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('Active deployment:'.padEnd(len+2), bold($(deployment.name).shortPath), contracts)
      const count = Object.values(state).length
      if (count > 0) {
        for (const name of Object.keys(state)) {
          this.receipt(name, state[name], len)
        }
      } else {
        this.info('This deployment is empty.')
      }
    } else {
      this.info('There is no selected deployment.')
    }
    this.br()
  }
  receipt (name: string, receipt: any, len = 35) {
    name = bold(name.padEnd(len))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      this.info(' │', name, address, codeId)
    } else {
      this.info(' │ (non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }
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
  deploymentList (chainId: string, deployments: DeployStore) {
    const list = deployments.list()
    if (list.length > 0) {
      this.info(`Deployments on chain ${bold(chainId)}:`)
      let maxLength = 0
      for (let name of list) {
        if (name === deployments.KEY) continue
        maxLength = Math.max(name.length, maxLength)
      }
      for (let name of list) {
        if (name === deployments.KEY) continue
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
