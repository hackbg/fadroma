import { ContractAPI } from '@fadroma/ops'

export class ScrtContract extends ContractAPI {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
}
