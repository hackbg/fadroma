import { ContractCaller } from '@fadroma/ops'

export class ScrtContract extends ContractCaller {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
}
