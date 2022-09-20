import { Env } from '@hackbg/konfizi'
import { bold } from '@hackbg/konzola'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { CommandContext } from '@hackbg/komandi'
import { ConnectConfig, ConnectConsole, ConnectContext } from '@fadroma/connect'
import { Chain, Agent, Deployment, Uploader, override } from '@fadroma/client'
import type { Class } from '@fadroma/client'
import { FSUploader } from './upload'
import { DeployConfig } from './deploy-config'
import { DeployConsole } from './deploy-events'

/** We support several of those:
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
  /** Path to where the receipts are stored. */
  string|Path,
  /** Defaults when creating Deployment instances from the store */
  Partial<Deployment>|undefined
]> {}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */ 
export abstract class DeployStore {
  /** Name of symlink marking active deployment. */
  KEY = '.active'
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Get the names of all stored deployments. */
  abstract list   ():              string[]
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
}

/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployContext extends CommandContext {
  constructor (
    /** A whole DeployConfig object, or just relevant options. */
    config:             Partial<DeployConfig> = new DeployConfig(),
    /** Chain to connect to. */
    public chain:       Chain|null            = null,
    /** Agent to identify as. */
    public agent:       Agent|null            = null,
    /** Contains available deployments for the current chain. */
    public deployments: DeployStore|null      = null,
    /** Implements uploading and upload reuse. */
    public uploader:    Uploader|null         = null,
  ) {
    super('connect', 'connection manager')
    this.config = new DeployConfig(this.env, this.cwd, config)
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }
  /** Logger. */
  log = new DeployConsole('Fadroma Deploy')
  /** Configuration. */
  config: DeployConfig
  /** Path to root of project directory. */
  get project (): Path|undefined {
    return this.config?.project ? $(this.config.project) : undefined
  }
  /** Currently selected deployment. */
  get deployment (): Deployment|null { return this.deployments?.active || null }
  /** Print a list of deployments on the selected chain. */
  list = this.command('deployments', `print a list of all deployments on this chain`,
    (): DeployStore => {
      const deployments = this.expectEnabled()
      this.log.deploymentList(this.chain?.id??'(unspecified)', deployments)
      return deployments
    })
  /** Make a new deployment the active one. */
  select = this.command('select', `select another deployment on this chain`,
    async (id?: string): Promise<void> => {
      const deployments = this.expectEnabled()
      const list = deployments.list()
      if (list.length < 1) {
        this.log.info('\nNo deployments. Create one with `deploy new`')
      }
      if (id) {
        this.log.info(bold(`Selecting deployment:`), id)
        await deployments.select(id)
      }
      if (list.length > 0) {
        this.list()
      }
      if (deployments.active) {
        this.log.info(`Currently selected deployment:`, bold(deployments.active.name))
      } else {
        this.log.info(`No selected deployment.`)
      }
    })
  /** Create a new deployment and add it to the command context. */
  create = this.command('create', `create a new empty deployment on this chain`,
    async (name: string = this.timestamp): Promise<void> => {
      const deployments = this.expectEnabled()
      await deployments?.create(name)
      await deployments?.select(name)
    })
  /** Print the status of a deployment. */
  status = this.command('status', 'show the current deployment',
    async (id?: string): Promise<void> => {
      const deployments = this.expectEnabled()
      const deployment  = id ? deployments.get(id) : deployments.active
      if (deployment) {
        this.log.deployment({ deployment })
      } else {
        this.log.info('No selected deployment on chain:', bold(this.chain?.id??'(no chain)'))
      }
    })
  /** Throws is deployment store is missing. */
  private expectEnabled = (): DeployStore => {
    if (!(this.deployments instanceof DeployStore)) {
      //this.log.error('context.deployments was not populated')
      //this.log.log(context)
      throw new Error('Deployment strore not found')
    }
    return this.deployments
  }
  /** Attach an instance of the DeployContext `ctor`, created with arguments `[this, ...args]`,
    * to the command tree under `name`, with usage description `info`. See the documentation
    * of `interface Subsystem` for more info.
    * @returns an instance of `ctor` */
  subsystem = <X extends Deployment>(
    name: string,
    info: string,
    ctor: Subsystem<X>,
    ...args: unknown[]
  ): X => this.commands(name, info, new ctor(this, ...args)) as X
}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts),
  * and whose constructor takes a DeployContext as first argument, as well as any number of
  * other arguments. This interface can be used to connect the main project class to individual
  * deployer classes for different parts of the project, enabling them to operate in the same
  * context (chain, agent, builder, uploader, etc). */
export interface Subsystem<D extends Deployment> extends Class<D, [
  DeployContext|unknown,
  ...unknown[]
]> {}
