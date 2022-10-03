import type { Deployment, DeployStore } from '@fadroma/client'
import { ConnectConsole, ConnectError } from '@fadroma/connect'
import $ from '@hackbg/kabinet'
import { bold, colors } from '@hackbg/konzola'

export class DeployConsole extends ConnectConsole {
  constructor (public name = 'Fadroma Deploy') { super(name) }
  deployment ({ deployment }: { deployment: Deployment }) {
    this.br()
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.max(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('Active deployment:'.padEnd(len+2), bold($(deployment.name).shortPath), contracts)
      const count = Object.values(state).length
      if (count > 0) {
        this.br()
        this.info('Contracts in this deployment:')
        for (const name of Object.keys(state)) {
          this.receipt(name, state[name], len)
        }
      } else {
        this.info('No contracts in this deployment.')
      }
    } else {
      this.info('There is no selected deployment.')
    }
    this.br()
  }
  receipt (name: string, receipt?: any, len?: number) {
    name    ||= '(unnamed)'
    receipt ||= {}
    len     ??= 35
    let {
      address    = colors.gray('(unspecified address)'),
      codeHash   = colors.gray('(unspecified code hash)'),
      codeId     = colors.gray('(unspecified code id)'.padEnd(len)),
      crate      = colors.gray('(unspecified crate)'.padEnd(len)),
      repository = colors.gray('(unspecified source)'.padEnd(len))
    } = receipt
    name = bold(name.padEnd(len))
    if (this.indent + len + 64 < this.width - 4) {
      codeId = bold(codeId.padEnd(len))
      crate  = bold(crate.padEnd(len))
      this.info()
      this.info(name,   '│', address)
      this.info(codeId, '│', codeHash)
      if (receipt.crate || receipt.repository) this.info(crate, repository)
    } else {
      this.info()
      this.info(name)
      this.info(address)
      this.info(codeHash)
      this.info(codeId)
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
