import { SigningCosmWasmClient, BroadcastMode, InstantiateResult, ExecuteResult } from 'secretjs'

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

  submitRetries      = 10
  resultSubmitDelay  = 1000
  blockQueryInterval = 1000
  resultRetries      = 10
  resultRetryDelay   = 2000

  async instantiate (codeId, initMsg, label, memo?, transferAmount?, fee?, hash?) {
    let {transactionHash:id} = await super.instantiate(
      codeId, initMsg, label, memo, transferAmount, fee, hash
    )
    return await this.getTxResult(id) as unknown as InstantiateResult
  }

  async execute (contractAddress, handleMsg, memo?, transferAmount?, fee?, contractCodeHash?) {
    let {transactionHash:id} = await super.execute(
      contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash
    )
    return await this.getTxResult(id) as unknown as ExecuteResult
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

    // 1. This patch only works in non-default broadcast modes (Sync or Async);
    //    in Block mode there is no way to get the tx hash of a half-failed TX.
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      console.warn(
        '[@fadroma/scrt-1.2] Broadcast mode is set to BroadcastMode.Block, bypassing patch'
      )
      return super.postTx(tx)
    }

    // 2. Loop until we run out of retries or a TX result is successfully obtained.
    let id: string|null = null
    let submitRetries = this.submitRetries
    while (submitRetries--) {

      // 3. Store the block height at which the TX was sent
      const sent = (await this.getBlock()).header.height

      // 4. Submit the transaction
      try {
        const result = await super.postTx(tx)
        id = result.transactionHash
      } catch (e) {
        id = null
        if (this.shouldRetry(e.message)) {
          console.warn(`Submitting TX failed (${e.message}): ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
        } else {
          console.warn(`Submitting TX failed (${e.message}): not retrying`)
          throw e
        }
      }

      // 5. If we got a transaction hash, start querying for the full transaction info.
      if (id) {
        try {
          return await this.getTxResult(id)
        } catch (e) {
          if (this.shouldRetry(e.message)) {
            // 4. If the transaction simply hasn't committed yet,
            //    query for the result again until we run out of retries.
            console.info(`Getting result of TX ${id} failed (${e.message}): ${submitRetries} retries left...`)
            await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
          } else {
            // 5. If the transaction resulted in an error, rethrow it so it can be decrypted
            //    FIXME: is this necessary now that txById is being used?
            console.info(`Getting result of TX ${id} failed (${e.message}): not retrying`)
            throw e
          }
        }
      }

    }

    throw new Error(`TX ${id} failed after ${this.submitRetries} retries.`)

  }

  async getTxResult (id: string) {

    // 1. Loop until we run out of retires or we successfully get a TX result
    let resultRetries = this.resultRetries
    while (resultRetries--) {

      try {

        // 2. Try getting the transaction by id
        console.debug(`[@fadroma/scrt-1.2] Requesting result of TX ${id}`)
        const result = await this.restClient.txById(id)
        const {raw_log, logs = []} = result as any

        // 3. If the raw log contains a known failure message, throw error
        if (!this.shouldRetry(raw_log, true)) {
          console.warn(`[@fadroma/scrt-1.2] TX ${id} failed`)
          throw new Error(raw_log)
        }

        // 4. Set tx hash and logs on the tx result and return it
        Object.assign(result, { transactionHash: id, logs })
        return result

      } catch (e) {

        if (this.shouldRetry(e.message)) {
          console.info(`Getting result of TX ${id} failed (${e.message}): ${resultRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
        } else {
          console.info(`Getting result of TX ${id} failed (${e.message}): not retrying`)
          throw e
        }

      }

    }

  }

  private shouldRetry (message: string, isActuallyOk: boolean = false): boolean {

    if (message.includes('404')) {
      console.warn('[@fadroma/scrt-1.2] Commit lag, retrying')
      return true
    }

    // out of gas fails immediately
    if (message.includes('out of gas')) {
      console.warn('[@fadroma/scrt-1.2] Out of gas, not retrying')
      return false
    }

    // account sequence mismatches are retried
    if (message.includes('account sequence mismatch')) {
      console.warn('[@fadroma/scrt-1.2] Nonce lag, retrying')
      return true
    }

    // tx failures are thrown
    if (message.includes('failed')) {
      console.warn('[@fadroma/scrt-1.2] TX failed, not retrying')
      return false
    }

    // all other errors are retried
    if (!isActuallyOk) {
      console.warn('[@fadroma/scrt-1.2] Fetching tx result failed, retrying')
    } else {
      //console.info('[@fadroma/scrt-1.2] Fetching tx result succeeded')
    }
    return true

  }

}
