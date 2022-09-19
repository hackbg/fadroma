import { EnvConfig } from '@hackbg/konfizi'
import type { Env } from '@hackbg/konfizi'
import { ConnectConfig } from '@fadroma/connect'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { DeployContext } from './deploy-base'
import type { Deployments } from './deploy-base'
import { YAMLDeployments_v1 } from './deploy-yaml1'
import { YAMLDeployments_v2 } from './deploy-yaml2'
import { JSONDeployments_v1 } from './deploy-json1'
import { FSUploader } from './upload'

export class DeployConfig extends EnvConfig {
  constructor (
    readonly env: Env = {},
    readonly cwd: string = '',
    defaults: Partial<DeployConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }
  connection:  ConnectConfig = new ConnectConfig(this.env, this.cwd)
  /** Project root. Defaults to current working directory. */
  project:     string        = this.getString ('FADROMA_PROJECT',      () => this.cwd)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig:    boolean       = this.getBoolean('FADROMA_MULTISIG',     () => false)
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload:    boolean       = this.getBoolean('FADROMA_REUPLOAD',     () => false)
  /** Directory to store the receipts for the deployed contracts. */
  uploads:     string        = this.getString ('FADROMA_UPLOAD_STATE', () =>
    $(this.project).in('receipts').in(this.connection.chainId).in('uploads').path)
  /** Directory to store the receipts for the deployed contracts. */
  deploys:     string        = this.getString ('FADROMA_DEPLOY_STATE', () =>
    $(this.project).in('receipts').in(this.connection.chainId).in('deployments').path)
  /** Which implementation of the receipt store to use. */
  deployStore: DeployStore   = this.getString('FADROMA_DEPLOY_STORE', () => 'YAML1') as DeployStore
  /** Create a new populated DeployContext.
    * @returns DeployContext */
  async init (): Promise<DeployContext> {
    const { chain, agent } = await this.connection.connect()
    if (!chain) throw new Error('Missing chain')
    const Deployments = DeployStores[this.deployStore]
    if (!Deployments) throw new Error('Missing deployment store constructor')
    const deployments = new Deployments(this.deploys)
    const uploader    = new FSUploader(agent, this.uploads)
    return new DeployContext(this, chain, agent, deployments, uploader)
  }
}

export type DeployStore = 'YAML1'|'YAML2'|'JSON1'

export interface DeployStoreCtor { new (path: string|Path): Deployments }

export const DeployStores: Partial<Record<DeployStore, DeployStoreCtor>> = {}
