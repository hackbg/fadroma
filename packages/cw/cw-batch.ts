import { Core, Chain } from '@fadroma/agent'
import type { CWConnection } from './cw-connection'

/** Transaction batch for CosmWasm-enabled chains. */
export class CWBatch extends Chain.Batch<CWConnection> {
  upload (
    code:    Parameters<Chain.Batch<Chain.Connection>["upload"]>[0],
    options: Parameters<Chain.Batch<Chain.Connection>["upload"]>[1]
  ) {
    throw new Core.Error("CWBatch#upload: not implemented")
    return this
  }
  instantiate (
    code:    Parameters<Chain.Batch<Chain.Connection>["instantiate"]>[0],
    options: Parameters<Chain.Batch<Chain.Connection>["instantiate"]>[1]
  ) {
    throw new Core.Error("CWBatch#instantiate: not implemented")
    return this
  }
  execute (
    contract: Parameters<Chain.Batch<Chain.Connection>["execute"]>[0],
    options:  Parameters<Chain.Batch<Chain.Connection>["execute"]>[1]
  ) {
    throw new Core.Error("CWBatch#execute: not implemented")
    return this
  }
  async submit () {}
}

