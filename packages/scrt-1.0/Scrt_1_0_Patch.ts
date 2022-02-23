import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'

export class PatchedSigningCosmWasmClient_1_0 extends SigningCosmWasmClient {
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
    addr: string, query: object, params?: object, hash?: string
  ): Promise<any> {
    let retries = 20
    while (retries--) {
      try {
        return super.queryContractSmart(addr, query, params, hash)
      } catch (e) {
        if (isConnectionError(e)) {
          await new Promise(ok=>setTimeout(ok, 2000))
          continue
        } else {
          throw e
        }
      }
    }
  }
}

export const isConnectionError = (e: Error & {code:any}) => (
  e.message.includes('socket hang up') ||
  e.code === 'ECONNRESET'
)
