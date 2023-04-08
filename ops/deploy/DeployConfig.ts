import { FSUploader } from '../upload/index'

import { ConnectConfig } from '@fadroma/connect'
import { Deployment, DeployStore } from '@fadroma/agent'
import type { DeploymentClass, DeploymentFormat, DeployStoreClass } from '@fadroma/agent'

import $ from '@hackbg/file'

/** Deployment system configuration and factory for populated Deployments. */
export default class DeployConfig extends ConnectConfig {

  /** Project root. Defaults to current working directory. */
  project: string = this.getString(
    'FADROMA_PROJECT',
    () => this.environment.cwd)

  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getFlag(
    'FADROMA_MULTISIG',
    () => false)

  /** Directory to store the receipts for the deployed contracts. */
  deployState: string | null = this.getString(
    'FADROMA_DEPLOY_STATE',
    () => this.chainId ? $(this.project).in('receipts').in(this.chainId).in('deployments').path : null)

  /** Which implementation of the receipt store to use. */
  deploymentFormat = this.getString(
    'FADROMA_DEPLOY_STORE',
    () => 'YAML1'
  ) as DeploymentFormat

  /** The deploy receipt store implementation selected by `deploymentFormat`. */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploymentFormat]
  }

  /** Get an instance of the selected deploy store implementation. */
  getDeployStore <S extends DeployStore> (
    $S: DeployStoreClass<S>|undefined = this.DeployStore as DeployStoreClass<S>
  ): S {
    if (!$S) throw new Error('Missing deployment store constructor')
    return new $S(this.deployState)
  }

  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    const chain = this.getChain()
    if (!chain) throw new Error('Missing chain')
    const agent = this.getAgent()
    const store = this.getDeployStore()
    args[0] = Object.assign({
      config:   this,
      chain:    store.defaults.chain    = chain!,
      agent:    store.defaults.agent    = agent!,
      uploader: store.defaults.uploader = agent!.getUploader(FSUploader),
      store
    }, args[0]??{})
    console.log({$D})
    return new $D()
  }

}
