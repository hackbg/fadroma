import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

  submitRetries      = 10
  resubmitDelay      = 1000
  blockQueryInterval = 1000
  resultRetries      = 10
  resultRetryDelay   = 2000

  async instantiate (...args: Array<any>) {
    let {transactionHash:id} = await super.instantiate(...args)
    return await this.getTxResult(id)
  }

  async execute (...args: Array<any>) {
    let {transactionHash:id} = await super.execute(...args)
    return await this.getTxResult(id)
  }

  async waitForNextBlock (sent: number) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }

  async waitForNextNonce (sent: number) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }

  async postTx (tx: any): Promise<any> {

    // Only override for non-default broadcast modes
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      console.warn(
        '[@fadroma/scrt-1.2] Broadcast mode is set to BroadcastMode.Block, bypassing patch'
      )
      return super.postTx(tx)
    }

    let submitRetries = this.submitRetries
    while (submitRetries--) {

      // 1. Submit the transaction
      const sent = (await this.getBlock()).header.height
      const {transactionHash: id} = await super.postTx(tx)

      // 2. Poll for block height to increment
      await this.waitForNextBlock(sent)

      // 3. Start querying for the full result.
      try {
        return await this.getTxResult(id)
      } catch (error) {
        if (error.rethrow) {
          // 4. If the transaction resulted in an error, rethrow it so it can be decrypted
          console.warn(`Transaction ${id} returned error:\n${error.message}`)
          throw error
        } else {
          // 5. If the transaction simply hasn't committed yet, query for the result again.
          console.info(`Submit TX: ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resubmitDelay))
        }
      }

    }

  }

  async getTxResult (id: string) {

    let resultRetries = this.resultRetries

    while (resultRetries--) {

      try {

        console.debug(`[@fadroma/scrt-1.2] Requesting result of tx ${id}`)
        const result = await this.restClient.get(`/txs/${id}`)
        const {raw_log, logs = []} = result as any

        if (this.shouldRethrow(raw_log)) {
          console.warn(`[@fadroma/scrt-1.2] Transaction ${id} failed`)
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

        if (process.env.FADROMA_PRINT_TXS) {
          //console.warn(error.message)
          //console.info(`Requesting result of ${id}: ${resultRetries} retries left`)
        }

        await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))

      }

    }

  }

  private shouldRethrow (raw_log: string): boolean {

    // out of gas fails immediately
    if (raw_log.includes('out of gas')) return true

    if (raw_log.includes('failed')) {

      // account sequence mismatch is retried
      if (raw_log.includes('account sequence mismatch')) {
        return false
      }

      // all other tx failures are thrown
      return true

    }

    // all other errors are retried
    return false

  }

}
