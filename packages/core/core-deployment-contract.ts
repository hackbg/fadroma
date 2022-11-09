import type { Client } from './core-client'
import type { Deployment } from './core-deployment'
import type { Contract } from './core-contract'
import { ClientError as Error } from './core-events'
import { defineContract } from './core-contract'
import { attachToDeployment } from './core-deploy-attach'

export type DefineContract =
  <C extends Client>(arg?: string|Partial<Contract<C>>) => Contract<C>

export function defineDeploymentContractAPI <D extends Deployment> (
  self: D
): (DefineContract & DeployContractAPI) {

  return Object.assign(
    defineContractInDeployment.bind(self),
    defineDeployContractAPI(self)
  )

  function defineContractInDeployment <C extends Client> (
    arg: string|Partial<Contract<C>> = {}
  ): Contract<C> {
    const name = (typeof arg === 'string') ? arg : arg.name
    const opts = (typeof arg === 'string') ? { name } : arg
    opts.agent ??= this.agent
    if (name && this.contract.has(name)) {
      return this.contract.get(name)
    } else {
      return this.contract.set(name, defineContract(opts))
    }
  }

}

/** Methods for managing individual contracts in a `Deployment` */
export interface DeployContractAPI {
  /** Check if the deployment contains a contract with a certain name. */
  has (name: string): boolean
  /** Get the Contract corresponding to a given name. */
  get <C extends Client> (name: string): Contract<C>|null
  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. */
  set <C extends Client> (name: string, data: Contract<C>): Contract<C>
  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. Chainable. */
  add <C extends Client> (name: string, data: Contract<C>): this
  /** Throw if a contract with the specified name is not found in this deployment. */
  expect <C extends Client> (message?: string): Contract<C>
}

export const defineDeployContractAPI = (d: Deployment): DeployContractAPI => ({

  has (name) {
    return !!d.state[name]
  },

  get (name) {
    return d.state[name]
  },

  set (name, contract) {
    d.state[name] = attachToDeployment(contract, d)
    d.save()
    return contract
  },

  add (name, contract) {
    this.set(name, contract)
    return this
  },

  expect (message) {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return d.contract({...receipt, name})
    throw new Error(message)
  },

})
