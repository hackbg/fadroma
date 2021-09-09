import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'
import { ScrtAgentJS, Identity } from '@fadroma/scrt'

export class PatchedSigningCosmWasmClient extends SigningCosmWasmClient {
  /* this assumes broadcastMode is set to BroadcastMode.Sync
     which it is, via the constructor of the base ScrtAgentJS class
     which, in turn, assumes the logs array is empty and just a tx hash is returned
     the tx hash is then queried to get the full transaction result
     or, if the transaction didn't actually commit, to retry it */
  async postTx (tx: any): Promise<any> {
    // only override for non-default broadcast modes
    if ((this.restClient as any).broadcastMode === BroadcastMode.Block) {
      console.info('broadcast mode is block, bypassing patch')
      return super.postTx(tx) }
    // try posting the transaction
    let submitRetries = 10
    while (submitRetries--) {
      // get current block number
      const sent = (await this.getBlock()).header.height
      // submit the transaction and get its id
      const submitResult = await super.postTx(tx)
      console.debug({submitResult})
      const id = submitResult.transactionHash
      // wait for next block
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = (await this.getBlock()).header.height
        //console.debug(id, sent, now)
        if (now > sent) break }
      // once the block has incremented, get the full transaction result
      let resultRetries = 10
      while (resultRetries--) {
        try {
          const result = await this.restClient.get(`/txs/${id}`)
          console.debug('<',result)
          // if result contains error, throw it
          const {raw_log} = result as any
          if (raw_log.includes('failed')) throw new Error(raw_log)
          Object.assign(result, { transactionHash: id, logs: ((result as any).logs)||[] })
          return result }
        catch (e) {
          // retry only on 404, throw all other errors to decrypt them
          if (!e.message.includes('404')) throw e
          console.warn(`failed to query result of tx ${id} with the following error, ${resultRetries} retries left`)
          console.warn(e)
          await new Promise(ok=>setTimeout(ok, 2000))
          continue } }
      console.warn(`failed to submit tx ${id}, ${submitRetries} retries left...`)
      await new Promise(ok=>setTimeout(ok, 1000)) } } }

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  static create = (options: Identity) => ScrtAgentJS.createSub(ScrtAgentJS_1_0, options)
  constructor (options: Identity) { super(PatchedSigningCosmWasmClient, options) } }
