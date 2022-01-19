import { BaseContractClient, buildScript } from '@fadroma/scrt'
import { resolve, dirname, fileURLToPath } from '@hackbg/tools'

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

import type { TransactionExecutor, QueryExecutor } from '@fadroma/scrt'
import { AugmentedScrtContract } from '@fadroma/scrt'
export class AugmentedScrtContract_1_0<
  Executor extends TransactionExecutor,
  Querier  extends QueryExecutor
> extends AugmentedScrtContract<Executor, Querier> {
  buildImage      = buildImage
  buildDockerfile = buildDockerfile
  buildScript     = buildScript
}
