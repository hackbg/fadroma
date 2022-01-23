import {
  BaseContractClient, AugmentedContractClient,
  TransactionExecutor, QueryExecutor
} from '@fadroma/ops'

export class ScrtContract extends BaseContractClient {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
}

export class AugmentedScrtContract<
  Executor extends TransactionExecutor,
  Querier  extends QueryExecutor
> extends AugmentedContractClient<Executor, Querier> {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
  static Queries      = QueryExecutor
  static Transactions = TransactionExecutor
}

export { TransactionExecutor, QueryExecutor }
