import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'
import { ScrtAgentJS } from '@fadroma/scrt'

import { Console } from '@hackbg/tools'
const console = Console('@fadroma/scrt-1.0')

export class PatchedSigningCosmWasmClient_1_0 extends SigningCosmWasmClient {

  /* this assumes broadcastMode is set to BroadcastMode.Sync
     which it is, via the constructor of the base ScrtAgentJS class
     which, in turn, assumes the logs array is empty and just a tx hash is returned
     the tx hash is then queried to get the full transaction result
     or, if the transaction didn't actually commit, to retry it */
  async postTx (tx: any): Promise<any> {

    // only override for non-default broadcast modes
    if ((this.restClient as any).broadcastMode === BroadcastMode.Block) {
      console.info('broadcast mode is block, bypassing patch')
      return super.postTx(tx)
    }

    // try posting the transaction
    let submitRetries = 20
    while (submitRetries--) {

      // get current block number
      const sent = (await this.getBlock()).header.height

      // submit the transaction and get its id
      const submitResult = await super.postTx(tx)
      const id = submitResult.transactionHash

      // wait for next block
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = (await this.getBlock()).header.height
        //console.debug(id, sent, now)
        if (now > sent) break
      }
      await new Promise(ok=>setTimeout(ok, 1000))

      // once the block has incremented, get the full transaction result
      let resultRetries = 20
      while (resultRetries--) {
        try {
          const result = await this.restClient.get(`/txs/${id}`)
          // if result contains error, throw it
          const {raw_log} = result as any
          if (raw_log.includes('failed')) throw new Error(raw_log)
          Object.assign(result, { transactionHash: id, logs: ((result as any).logs)||[] })
          return result
        } catch (e) {
          // retry only on 404, throw all other errors to decrypt them
          if (!e.message.includes('404')) throw e
          console.warn(`failed to query result of tx ${id} with the following error, ${resultRetries} retries left`)
          console.warn(e)
          await new Promise(ok=>setTimeout(ok, 2000))
          continue
        }
      }

      console.warn(`failed to submit tx ${id}, ${submitRetries} retries left...`)
      await new Promise(ok=>setTimeout(ok, 1000))
    }
  }

  async queryContractSmart (
    contractAddress:   string,
    query:             object,
    addedParams?:      object,
    contractCodeHash?: string
  ): Promise<any> {
    let retries = 20
    while (retries--) {
      try {
        return super.queryContractSmart(
          contractAddress,
          query,
          addedParams,
          contractCodeHash)
      } catch (e) {
        if (
          e.message.includes('socket hang up') ||
          e.code === 'ECONNRESET'
        ) {
          await new Promise(ok=>setTimeout(ok, 2000))
          continue
        } else {
          throw e
        }
      }
    }
  }

}

export class ScrtAgentJS_1_0 extends ScrtAgentJS {

  static create = (options: Identity): Promise<Agent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_0 as unknown as AgentClass, options)

  constructor (options: Identity) {
    super(PatchedSigningCosmWasmClient_1_0, options)
  }
}
