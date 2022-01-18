import { BaseContractClient } from '@fadroma/ops'

export class ScrtContract extends BaseContractClient {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
}
