import Deployer from './Deployer'
import type { DeployerClass } from './Deployer'
import FSUploader from './FSUploader'

import { ConnectConfig } from '@fadroma/connect'
import { DeployStore } from '@fadroma/core'
import type { DeploymentFormat, DeployStoreClass } from '@fadroma/core'

import $ from '@hackbg/file'
import type { Env } from '@hackbg/conf'

/** Deployment system configuration and Deployer factory. */
export default class DeployConfig extends ConnectConfig {
  //constructor (
    //defaults: Partial<DeployConfig> = {},
    //readonly env: Env    = process.env,
    //readonly cwd: string = process.cwd(),
  //) {
    //super(defaults as Partial<ConnectConfig>, env ?? process.env, cwd ?? process.cwd())
    //this.override(defaults)
  //}
  /** Project root. Defaults to current working directory. */
  project:  string  = this.getString ('FADROMA_PROJECT',  () => this.cwd)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG', () => false)
  /** Directory to store the receipts for the deployed contracts. */
  deployState:  string  = this.getString ('FADROMA_DEPLOY_STATE',
    () => $(this.project).in('receipts').in(this.chainId).in('deployments').path)
  /** Which implementation of the receipt store to use. */
  deploymentFormat  = this.getString('FADROMA_DEPLOY_STORE', () => 'YAML1') as DeploymentFormat
  /** The deploy receipt store implementation selected by `deploymentFormat`. */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploymentFormat]
  }
  /** Get an instance of the selected deploy store implementation. */
  async getDeployStore <S extends DeployStore> (
    $S: DeployStoreClass<S>|undefined = this.DeployStore as DeployStoreClass<S>
  ): Promise<S> {
    if (!$S) throw new Error('Missing deployment store constructor')
    return new $S(this.deployState)
  }
  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  async getDeployer <C extends Deployer, D extends DeployerClass<C>> (
    $D: D = Deployer as D, ...args: ConstructorParameters<D>
  ): Promise<C> {
    const { chain, agent } = await this.getConnector()
    const uploader = agent!.getUploader(FSUploader)
    const store = await this.getDeployStore()
    store.defaults.agent    = agent!
    store.defaults.chain    = chain!
    store.defaults.uploader = uploader
    if (!chain) throw new Error('Missing chain')
    args[0] = { config: this, chain, agent, uploader, store, ...args[0]??{} }
    //@ts-ignore
    const deployer = new $D(...args)
    return deployer as unknown as C
  }
}
