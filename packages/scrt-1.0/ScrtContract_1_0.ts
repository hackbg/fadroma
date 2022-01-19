import {
  BaseContractClient, buildScript,
  resolve, dirname, fileURLToPath,
} from '@fadroma/scrt'

import {
  AugmentedScrtContract, TransactionExecutor, QueryExecutor
} from '@fadroma/scrt/ScrtContract.ts'

const
  __dirname       = dirname(fileURLToPath(import.meta.url)),
  buildImage      = 'hackbg/fadroma-scrt-builder:1.0',
  buildDockerfile = resolve(__dirname, 'ScrtBuild_1_0.Dockerfile')

export { buildImage, buildDockerfile }

export class ScrtContract_1_0 extends BaseContractClient {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}

export class AugmentedScrtContract_1_0<
  Executor extends TransactionExecutor,
  Querier  extends QueryExecutor
> extends AugmentedScrtContract<Executor, Querier> {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}
