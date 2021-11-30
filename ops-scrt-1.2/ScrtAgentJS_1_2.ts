import { Identity, IAgent } from '@fadroma/ops'
import { ScrtAgentJS } from '@fadroma/scrt/ScrtAgentJS.ts'
import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'
import type { StdTx, PostTxResult } from 'secretjs'

import { Console } from '@fadroma/tools'
const console = Console(import.meta.url)

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

  submitRetries      = 10
  resubmitDelay      = 1000
  blockQueryInterval = 1000
  resultRetries      = 10
  resultRetryDelay   = 2000

  /** This assumes broadcastMode is set to BroadcastMode.Sync
    * (which it is, via the constructor of the base ScrtAgentJS class).
    *
    * This, in turn, assumes the logs array is empty and just a tx hash is returned.
    * The tx hash is then queried to get the full transaction result -
    * or, if the transaction didn't actually commit, to retry it. */
  async postTx (tx: StdTx): Promise<any> {

    // Only override for non-default broadcast modes
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      console.info('Broadcast mode is block, bypassing patch')
      return super.postTx(tx)
    }

    // 1. Submit the transaction
    // 2. Poll for block height to increment
    // 3. Start querying for the full resul.
    let submitRetries = this.submitRetries
    while (submitRetries--) {
      const sent = (await this.getBlock()).header.height
      const {transactionHash: id} = await super.postTx(tx)
      await this.waitForNextBlock(sent)
      try {
        return await this.getTxResult(id)
      } catch (error) {
        if (error.rethrow) {
          console.warn(`Transaction ${id} returned error: ${error.message}`)
          throw error
        } else {
          console.info(`Submit tx: ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resubmitDelay))
        }
      }
    }

  }

  async waitForNextBlock (sent: number) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }

  async getTxResult (id: string) {

    let resultRetries = this.resultRetries
    while (resultRetries--) {
      try {

        console.info(`Querying result of tx ${id}`)
        const result = await this.restClient.get(`/txs/${id}`)

        // if result contains error, throw it so it can be decrypted
        const {raw_log, logs = []} = result as any
        if (raw_log.includes('failed')) {
          const error = new Error(raw_log)
          Object.assign(error, { rethrow: true })
          throw new Error(raw_log)
        }

        Object.assign(result, { transactionHash: id, logs })
        return result

      } catch (error) {

        // retry only on 404, throw all other errors to decrypt them
        if (!error.message.includes('404')) {
          Object.assign(error, { rethrow: true })
          throw error
        }

        console.warn(`Failed to query result of tx ${id}: ${error.message}`)
        console.info(`Querying result of ${id}: ${resultRetries} retries left`)
        await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
        continue
      }

    }

  }

  async instantiate (...args: Array<any>) {
    let {transactionHash:id} = await super.instantiate(...args)
    return await this.getTxResult(id)
  }

}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {

  static create = (options: Identity): Promise<IAgent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)

  constructor (options: Identity) {
    super(PatchedSigningCosmWasmClient_1_2, options)
  }

  async upload (pathToBinary: string) {
    const result = await super.upload(pathToBinary)
    // non-blocking broadcast mode returns code id -1
    // so we gotta manually fish it out from the transaction logs
    if (result.codeId === -1) {
      for (const log of result.logs) {
        for (const event of log.events) {
          for (const attribute of event.attributes) {
            if (attribute.key === 'code_id') {
              Object.assign(result, { codeId: Number(attribute.value) })
              break
            }
          }
        }
      }
    }
    
    return result
  }

}
