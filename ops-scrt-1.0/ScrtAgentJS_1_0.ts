import { SigningCosmWasmClient } from 'secretjs'
import { ScrtAgentJS, Identity } from '@fadroma/scrt'

export class PatchedSigningCosmWasmClient extends SigningCosmWasmClient {
  /* this assumes broadcastMode is set to BroadcastMode.Sync
     which it is, via the constructor of the base ScrtAgentJS class
     which, in turn, assumes the logs array is empty and just a tx hash is returned
     the tx hash is then queried to get the full transaction result
     or, if the transaction didn't actually commit, to retry it */
  async postTx (tx: any): Promise<any> {
    console.debug('patched postTx', tx)
    // get current block number
    const {header:{height:block}} = await this.getBlock()
    // submit the transaction and get its id
    const {transactionHash:id} = await super.postTx(tx)
    // wait for next block
    while (true) {
      await new Promise(ok=>setTimeout(ok, 1000))
      const {header:{height:now}} = await this.getBlock()
      console.debug(id, block, now)
      if (now > block) break }
    // once the block has incremented, get the full transaction result
    const actualResult = await this.restClient.get(`/txs/${id}`)
    console.debug('PATCHED', tx, id, actualResult)
    return actualResult
  }
  /* response comes decrypted as far as we care */
  async decryptTxsResponse (txsResponse: any): Promise<any> {
    return txsResponse
  }
}

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  static create = (options: Identity) => ScrtAgentJS.createSub(ScrtAgentJS_1_0, options)
  constructor (options: Identity) { super(PatchedSigningCosmWasmClient, options) }
}
