import { Console, Error } from './agent-base'
import type { Class, CodeHash } from './agent-base'
import type { ChainId } from './agent-chain'
import { Deployment, ContractTemplate } from './agent-contract'
import type { DeploymentClass, DeploymentState } from './agent-contract'

const toCodeHash = (codeHash: CodeHash|{ codeHash: CodeHash }): CodeHash => {
  if (typeof codeHash === 'object') codeHash = codeHash.codeHash
  if (!codeHash) throw new Error.Missing.CodeHash()
  return codeHash
}

export class UploadStore extends Map<CodeHash, ContractTemplate> {
  log = new Console('UploadStore')

  constructor (readonly chainId: ChainId) {
    super()
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): ContractTemplate|undefined {
    return super.get(toCodeHash(codeHash))
  }

  set (codeHash: CodeHash|{ codeHash: CodeHash }, value: Partial<ContractTemplate>): this {
    codeHash = toCodeHash(codeHash)
    if (!(value instanceof ContractTemplate)) value = new ContractTemplate(value)
    if (value.codeHash && (value.codeHash !== codeHash)) throw new Error.Invalid('code hash mismatch')
    return super.set(toCodeHash(codeHash), value as ContractTemplate)
  }
}

export type DeployStoreFormat = 'v1'

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeployStoreFormat, DeployStoreClass<DeployStore>>>

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  unknown,
  (Partial<Deployment>|undefined)?,
]> {}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export abstract class DeployStore {

  /** Default values for Deployments created from this store. */
  defaults: Partial<Deployment> = {}

  /** Create a new Deployment, and populate with stored data.
    * @returns Deployer */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as unknown as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    const { name } = args[0] ??= {}
    const deployment: D = $D.fromReceipt((name && this.load(name)) || {})
    deployment.store = this
    return deployment
  }

  /** Get the names of all stored deployments. */
  abstract list (): string[]

  /** Get a deployment by name, or the active deployment if none is passed. 
    * @returns Deployment, or null if such doesn't exist. */
  abstract load (name: string|null|undefined): DeploymentState|null

  /** Update a deployment's data. */
  abstract save (name: string, state?: DeploymentState): void

  /** Create a new deployment. */
  abstract create (name?: string): Promise<DeploymentState>

  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string): Promise<DeploymentState>

  /** Get name of the active deployment, or null if there isn't one. */
  abstract get activeName (): string|null

}
