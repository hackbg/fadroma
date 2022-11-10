import type { Task } from '@hackbg/komandi'
import type { Name } from './core-labels'
import type { AnyContract, DeployAnyContract, Instantiable, Uploadable } from './core-contract'
import type { Deployment } from './core-deployment'
import type { IntoRecord } from './core-fields'
import { into, intoRecord, defineTask, hide, mapAsync, call } from './core-fields'
import { Contract } from './core-contract'
import { Client } from './core-client'
import { ClientError as Error, ClientConsole as Console } from './core-events'
import { assertAgent } from './core-agent'
import { writeLabel, Named } from './core-labels'
import { attachToDeployment } from './core-deployment-attach'

export type DefineMultiContractAsArray =
  (contracts: AnyContract[]) => Promise<Client[]>

export type DefineMultiContractAsRecord =
  (contracts: Named<AnyContract>) => Promise<Named<Client>>

export type MatchPredicate =
  (meta: Partial<AnyContract>) => boolean|undefined

export function defineDeploymentContractsAPI <D extends Deployment> (
  self: D
): (DefineMultiContractAsArray | DefineMultiContractAsRecord) & DeployManyContractsAPI {

  return Object.assign(
    defineManyContractsInDeployment.bind(self),
    defineDeployManyContractsAPI(self)
  )

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

/** Methods for managing groups of contracts in a `Deployment` */
export interface DeployManyContractsAPI {
  /** Add multiple contracts to this deployment. */
  set (contracts: Array<Client|AnyContract>): this
  set (contracts: Record<string, Client|AnyContract>): this
  /** Compile multiple contracts. */
  build (contracts: (string|AnyContract)[]): Promise<AnyContract[]>
  /** Upload multiple contracts. */
  upload (contracts: AnyContract[]): Promise<AnyContract[]>
}

export const defineDeployManyContractsAPI = (d: Deployment) => ({

  set (this: Deployment, contracts: AnyContract[]|Named<AnyContract>) {
    throw new Error('TODO')
    for (const [name, receipt] of Object.entries(receipts)) this.state[name] = receipt
    this.save()
    return this
  },

  build: buildMany.bind(d),

  upload: uploadMany.bind(d)

})

async function buildMany (
    this: Deployment, contracts: (string|AnyContract)[]
): Promise<AnyContract[]> {
  return defineTask(`build ${contracts.length} contracts`, async () => {
    if (!this.builder) throw new Error.NoBuilder()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') {
        return this.contract({ crate: contract }) as AnyContract
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
      if (!this.builder) throw new Error.NoBuilder()
      return this.builder.buildMany(contracts as AnyContract[])
    }, this)
  }, this)
}

async function uploadMany (
  this: Deployment, contracts: AnyContract[]
): Promise<AnyContract[]> {
  return defineTask(`upload ${contracts.length} contracts`, async () => {
    if (!this.uploader) throw new Error.NoUploader()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') {
        return this.contract({ crate: contract })
      } else {
        return contract
      }
    })
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    return defineTask(`upload ${count} artifacts`, () => {
      if (!this.uploader) throw new Error.NoUploader()
      return this.uploader.uploadMany(contracts as Uploadable[])
    }, this)
  }, this)
}
