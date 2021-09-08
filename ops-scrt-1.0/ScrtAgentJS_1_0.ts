import { SigningCosmWasmClient } from 'secretjs'
import { ScrtAgentJS, Identity } from '@fadroma/scrt'

export class PatchedSigningCosmWasmClient extends SigningCosmWasmClient {
  /* this assumes broadcastMode is set to BroadcastMode.Sync
     which it is, via the constructor of the base ScrtAgentJS class
     which, in turn, assumes the logs array is empty and just a tx hash is returned
     the tx hash is then queried to get the full transaction result
     or, if the transaction didn't actually commit, to retry it */
  async postTx (tx: any): Promise<any> {
    let submitRetries = 10
    while (submitRetries--) {
      // get current block number
      const sent = (await this.getBlock()).header.height
      // submit the transaction and get its id
      const submitResult = await super.postTx(tx)
      //console.debug({submitResult})
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
          Object.assign(result, { transactionHash: id })
          return result }
        catch (e) {
          // handle only 404s
          console.warn(`failed to query result of tx ${id} with the following error, ${resultRetries} retries left`)
          console.warn(e)
          await new Promise(ok=>setTimeout(ok, 2000))
          continue } }
      console.warn(`failed to submit tx ${id}, ${submitRetries} retries left...`)
      await new Promise(ok=>setTimeout(ok, 1000)) } } }

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  static create = (options: Identity) => ScrtAgentJS.createSub(ScrtAgentJS_1_0, options)
  constructor (options: Identity) { super(PatchedSigningCosmWasmClient, options) }
}
