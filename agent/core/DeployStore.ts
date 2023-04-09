import type { Class, Client, AnyContract, DeploymentClass } from '../index'
import { Deployment } from './Deployment'

/** Transitional support for several of these:
  *  - YAML1 is how the latest @fadroma/ops stores data
  *  - YAML2 is how @aakamenov's custom Rust-based deployer stores data
  *  - JSON1 is the intended target format for the next major version;
  *    JSON can generally be parsed with fewer dependencies, and can be
  *    natively embedded in the API client library distribution,
  *    in order to enable a standard subset of receipt data
  *    (such as the up-to-date addresses and code hashes for your production deployment)
  *    to be delivered alongside your custom Client subclasses,
  *    making your API client immediately usable with no further steps necessary. */
export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

export type DeploymentState = Record<string, Partial<AnyContract>>

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  unknown,
  (Partial<Deployment>|undefined)?,
]> {}

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeploymentFormat, DeployStoreClass<DeployStore>>>

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export abstract class DeployStore {
  /** Populated in deploy.ts with the constructor for each subclass. */
  static variants: DeployStores = {}
  /** Get the names of all stored deployments. */
  abstract list (): string[]
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract load (name: string): DeploymentState|null
  /** Update a deployment's data. */
  abstract save (name: string, state?: DeploymentState): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<DeploymentState>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string): Promise<DeploymentState>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): DeploymentState|null

  defaults: Partial<Deployment> = {}

  /** Create a new Deployment, and populate with stored data.
    * @returns Deployer */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    // If a name of a deployment is provided, try to load
    // stored data about this deployment from this store.
    // Otherwise, start with a blank slate.
    const { name } = args[0] ??= {}
    const state = (name && this.load(name)) || {}
    // Create a deployment of the specified class.
    // If this is a subclass of Deployment that defines
    // contracts (using this.contract), the `state`
    // property will be populated.
    const deployment = new $D(...args)
    // Update properties of each named contract defined in
    // the deployment with those from the loaded data.
    // If such a named contract is missing, define it.
    for (const name of Object.keys(state)) {
      if (deployment.state[name]) {
        Object.assign(deployment.state[name], state[name])
      } else {
        deployment.contract(state[name])
      }
    }
    return deployment
  }
}
