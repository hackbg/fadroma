import type { AnyContract, DeployAnyContract, Instantiable, Uploadable } from './core-contract'
import type { DeployContract } from './core-contract'
import type { Deployment, DeployContractAPI } from './core-deployment'
import type { IntoRecord } from './core-fields'
import type { Name } from './core-labels'
import type { Task } from '@hackbg/komandi'
import { Client } from './core-client'
import { ClientError as Error, ClientConsole as Console } from './core-events'
import { Contract } from './core-contract'
import { assertAgent } from './core-agent'
import { attachToDeployment } from './core-deployment-attach'
import { defineContract } from './core-contract'
import { into, intoRecord, defineTask, hide, mapAsync, call } from './core-fields'
import { writeLabel, Named } from './core-labels'

export function defineDeployContractAPI <D extends Deployment> (
  self: D
): DeployContractAPI {

  return Object.assign(defineContractInDeployment.bind(self), {

    has (name) {
      return !!d.state[name]
    },

    get (name) {
      return d.state[name]
    },

    set <C extends Client> (name: string, contract: Contract<C>) {
      contract.context = d
      attachToDeployment(contract, d)
      d.state[name] = contract
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

  function defineContractInDeployment <C extends Client> (
    this: D, arg: string|Partial<Contract<C>> = {}
  ): DeployContract<C> {
    const name = (typeof arg === 'string') ? arg : arg.name
    const opts = (typeof arg === 'string') ? { name } : arg
    opts.agent ??= this.agent
    if (name && this.contract.has(name)) {
      return this.contract.get<C>(name)!.context!
    } else {
      const contract = defineContract({
        workspace: this.config?.build?.project,
        ...opts,
        prefix:  this.name,
        context: this
      })
      this.contract.set(contract.name!, contract)
      return contract
    }
  }

}

export type MatchPredicate =
  (meta: Partial<AnyContract>) => boolean|undefined

export function defineDeployContractsAPI <D extends Deployment> (
  self: D
): (DefineMultiContractAsArray | DefineMultiContractAsRecord) & DeployManyContractsAPI {

  return Object.assign(defineManyContractsInDeployment.bind(self), {

    set (this: Deployment, contracts: AnyContract[]|Named<AnyContract>) {
      throw new Error('TODO')
      for (const [name, receipt] of Object.entries(contracts)) {
        self.state[name] = receipt
      }
      self.save()
      return self
    },

    build (contracts: (string|AnyContract)[]) {
      return buildMany(self, contracts)
    },

    upload (contracts: AnyContract[]) {
      return uploadMany(self, contracts)
    }

  })

  function defineManyContractsInDeployment (this: D, contracts: AnyContract[]):
    Task<D, Client[]>
  function defineManyContractsInDeployment (this: D, contracts: Named<AnyContract>):
    Task<D, Named<Client>>
  function defineManyContractsInDeployment <T extends Task<D, Client[]>|Task<D, Named<Client>>> (
    this: D, contracts: AnyContract[]|Named<AnyContract>
  ): T {
    const length = Object.entries(contracts).length
    const name = (length === 1) ? `deploy contract` : `deploy ${length} contracts`
    return defineTask(name, deployMultipleContracts, this) as T
    async function deployMultipleContracts () {
      return mapAsync(contracts, call)
    }
  }

}

async function buildMany (
  context:   Partial<Deployment>,
  contracts: (string|AnyContract)[]
): Promise<AnyContract[]> {
  return defineTask(`build ${contracts.length} contracts`, async () => {
    if (!context.builder) throw new Error.NoBuilder()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') {
        return context.contract({ crate: contract }) as AnyContract
      } else {
        return contract
      }
    })
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    const sources = (contracts as AnyContract[])
      .map(contract=>`${contract.crate}@${contract.revision}`)
      .join(', ')
    return defineTask(`build ${count} ${sources}`, () => {
      if (!context.builder) throw new Error.NoBuilder()
      return context.builder.buildMany(contracts as AnyContract[])
    }, context)
  }, context)
}

async function uploadMany (
  context:   Partial<Deployment>,
  contracts: AnyContract[]
): Promise<AnyContract[]> {
  return defineTask(`upload ${contracts.length} contracts`, async () => {
    if (!context.uploader) throw new Error.NoUploader()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') {
        return context.contract({ crate: contract })
      } else {
        return contract
      }
    })
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    return defineTask(`upload ${count} artifacts`, () => {
      if (!context.uploader) throw new Error.NoUploader()
      return context.uploader.uploadMany(contracts as Uploadable[])
    }, context)
  }, context)
}
