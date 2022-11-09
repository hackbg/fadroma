import type { Class } from './core-fields'
import type { Client } from './core-client'
import type { AnyContract } from './core-contract'
import type { Deployment } from './core-deployment'

/** Transitional support for several of these:
  *  - YAML1 is how the latest @fadroma/deploy stores data
  *  - YAML2 is how @aakamenov's custom Rust-based deployer stores data
  *  - JSON1 is the intended target format for the next major version;
  *    JSON can generally be parsed with fewer dependencies, and can be
  *    natively embedded in the API client library distribution,
  *    in order to enable a standard subset of receipt data
  *    (such as the up-to-date addresses and code hashes for your production deployment)
  *    to be delivered alongside your custom Client subclasses,
  *    making your API client immediately usable with no further steps necessary. */
export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

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
  abstract list   ():              string[]
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Update a deployment's data. */
  abstract set    (name: string, state?: Record<string, Partial<AnyContract>>): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): Deployment|null

  defaults: Partial<Deployment> = {}
}

export type DeploymentState = Record<string, Partial<AnyContract>>
