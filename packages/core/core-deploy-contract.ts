import type { Client } from './core-connect'
import type { Deployment } from './core-deploy'
import type { ContractInstance } from './core-deploy-instance'
import { defineInstance } from './core-deploy-instance'
import { attachToDeployment } from './core-deploy-attach'

/** The base `deployment.contract()` method. Calling it returns a callable `ContractInstance`.
  * The `DeploymentcontractAPI` interface defines the other methods  available through
  * `deployment.contract.*` */
type DeploymentContract =
  <C extends Client>(arg?: string|Partial<ContractInstance<C>>)=>ContractInstance<C>

/** The extra methods added to `deployment.contract`. */
export interface DeploymentContractAPI extends DeploymentContract {
  /** Check if the deployment contains a contract with a certain name. */
  has (name: string): boolean
  /** Get the ContractInstance corresponding to a given name. */
  get <C extends Client> (name: string): ContractInstance<C>|null
  /** Set the ContractInstance corresponding to a given name,
    * attaching it to this deployment. */
  set <C extends Client> (name: string, data: ContractInstance<C>): ContractInstance<C>
  /** Set the ContractInstance corresponding to a given name,
    * attaching it to this deployment. Chainable. */
  add <C extends Client> (name: string, data: ContractInstance<C>): this
  /** Throw if a contract with the specified name is not found in this deployment. */
  expect <C extends Client> (message?: string): ContractInstance<C>
}

export function deploymentContractAPI <D extends Deployment> (self: D) {

  let fn = function contract <C extends Client> (
    arg: string|Partial<ContractInstance<C>> = {}
  ): ContractInstance<C> {
    const name = (typeof arg === 'string') ? arg : arg.name
    const opts = (typeof arg === 'string') ? { name } : arg
    opts.agent ??= this.agent
    if (name && this.contract.has(name)) {
      return this.contract.get(name)
    } else {
      return this.contract.set(name, defineInstance(opts))
    }
  }

  fn = fn.bind(self)

  const methods: DeploymentContractAPI = {

    has (name) {
      return !!this.state[name]
    },

    get (name) {
      return this.state[name]
    },

    set (name, contract) {
      this.state[name] = attachToDeployment(contract, this)
      this.save()
      return contract
    },

    add (name, contract) {
      this.set(name, contract)
      return this
    },

    expect (message) {
      message ??= `${name}: no such contract in deployment`
      const receipt = this.get(name)
      if (receipt) return this.contract({...receipt, name})
      throw new ClientError(message)
    },

  }

  for (const key in methods) fn[key] = methods[key].bind(self)

  return fn

}
