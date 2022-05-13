/** This is the latest version of the SigningCosmWasmClient async broadcast/retry patch. */

import { SigningCosmWasmClient, BroadcastMode } from 'secretjs'

export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

  _queryUrl = ''

  _queryClient = null

  get queryClient () {
    if (this._queryClient) return this._queryClient
    return this._queryClient = import('axios').then(axios=>axios.default.create({
      baseURL: this._queryUrl,
    })).catch(e=>{
      console.warn('Failed to create query client:', e.message, ' - falling back to default client')
      console.error(e)
      // @ts-ignore
      return this.client
    })
  }

  async get (path) {
    const client = await this.queryClient
    const { data } = await client.get(path).catch(parseAxiosError)
    if (data === null) {
      throw new Error("Received null response from server")
    }
    return data
  }

  submitRetries      = 20
  resultSubmitDelay  = 1500
  blockQueryInterval = 1000
  resultRetries      = 20
  resultRetryDelay   = 3000

  // @ts-ignore
  async instantiate (codeId, initMsg, label, memo, transferAmount, fee, hash) {
    return await this.getTxResult((await super.instantiate(
      codeId, initMsg, label, memo, transferAmount, fee, hash
    )).transactionHash)
  }

  // @ts-ignore
  async execute (contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash) {
    return await this.getTxResult((await super.execute(
      contractAddress, handleMsg, memo, transferAmount, fee, contractCodeHash
    )).transactionHash)
  }

  async waitForNextBlock (sent) {
    while (true) {
      await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      const now = (await this.getBlock()).header.height
      if (now > sent) break
    }
  }

  async waitForNextNonce (sent) {
    // TODO
    //while (true) {
      //await new Promise(ok=>setTimeout(ok, this.blockQueryInterval))
      //const now = (await this.getBlock()).header.height
      //if (now > sent) break
    //}
  }

  // @ts-ignore
  async postTx (tx) {

    //console.trace('postTx', tx.msg)

    const info = (...args) => console.info('[@fadroma/scrt/postTx]', ...args)
    const warn = (...args) => console.warn('[@fadroma/scrt/postTx]', ...args)

    // 0. Validate that we're not sending an empty transaction
    if (!tx || !tx.msg || !tx.msg.length || tx.msg.length < 1) {
      console.trace('Tried to post a transaction with no messages from HERE')
      throw new Error('Tried to post a transaction with no messages.')
    }

    // 1. This patch only works in non-default broadcast modes (Sync or Async);
    //    in Block mode there is no way to get the tx hash of a half-failed TX.
    if (this.restClient.broadcastMode === BroadcastMode.Block) {
      warn('Broadcast mode is set to BroadcastMode.Block, bypassing patch')
      return super.postTx(tx)
    }

    // 2. Loop until we run out of retries or a TX result is successfully obtained.
    let id = null
    let submitRetries = this.submitRetries
    while (submitRetries--) {

      // 3. Store the block height at which the TX was sent
      const sent = (await this.getBlock()).header.height

      // 4. Submit the transaction
      try {
        info(`Submitting TX (${JSON.stringify(tx).length} chars) (${submitRetries} retries left)...`)
        //info(`Submitting TX (${JSON.stringify(tx).slice(0, 200)}...) (${submitRetries} retries left)...`)
        const result = await super.postTx(tx)
        id = result.transactionHash
      } catch (e) {
        if (this.shouldRetry(e.message)) {
          warn(`Submitting TX failed (${e.message}): ${submitRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
        } else {
          warn(`Submitting TX failed (${e.message}): not retrying`)
          throw e
        }
      }

      // 5. Wait for the block height to increment
      await this.waitForNextBlock(sent)

      // 6. If we got a transaction hash, start querying for the full transaction info.
      if (id) {
        try {
          return await this.getTxResult(id)
        } catch (e) {
          const weirdPanic = e.message.includes('Enclave: panicked due to unexpected behavior')
          if (this.shouldRetry(e.message) || weirdPanic) {
            warn("Enclave error: actually, let's retry this one...")
            // 7. If the transaction simply hasn't committed yet,
            //    query for the result again until we run out of retries.
            warn(`Getting result of TX ${id} failed (${e.message}): ${submitRetries} retries left...`)
            await new Promise(ok=>setTimeout(ok, this.resultSubmitDelay))
          } else {
            // 8. If the transaction resulted in an error, rethrow it so it can be decrypted
            //    FIXME: is this necessary now that txById is being used?
            warn(`Getting result of TX ${id} failed (${e.message}): not retrying`)
            throw e
          }
        }
      }

    }

    throw new Error(`Submitting TX ${id} failed after ${this.submitRetries} retries.`)

  }

  async getTxResult (id) {

    const info = (...args) => console.info('[@fadroma/scrt/getTxResult]', ...args)
    const warn = (...args) => console.warn('[@fadroma/scrt/getTxResult]', ...args)

    // 1. Loop until we run out of retires or we successfully get a TX result
    let resultRetries = this.resultRetries
    while (resultRetries--) {

      try {

        // 2. Try getting the transaction by id
        info(`[@fadroma/scrt] Requesting result of TX ${id}`)
        const result = await this.restClient.txById(id)
        const {raw_log, logs = []} = result

        // 3. If the raw log contains a known failure message, throw error
        if (!this.shouldRetry(raw_log, true)) {
          warn(`[@fadroma/scrt] TX ${id} failed`)
          throw new Error(raw_log)
        }

        // 4. Set tx hash and logs on the tx result and return it
        Object.assign(result, { transactionHash: id, logs })
        return result

      } catch (e) {

        if (this.shouldRetry(e.message)) {
          warn(`Getting result of TX ${id} failed (${e.message}): ${resultRetries} retries left...`)
          await new Promise(ok=>setTimeout(ok, this.resultRetryDelay))
        } else {
          warn(`Getting result of TX ${id} failed (${e.message}): not retrying`)
          throw e
        }

      }

    }

    throw new Error(`Getting result of TX ${id} failed: ran out of retries.`)

  }

  shouldRetry (message, isActuallyOk = false) {

    const warn = (...args) => console.warn('[@fadroma/scrt/shouldRetry]', ...args)

    if (message.includes('does not support Amino serialization')) {
      warn('Protocol mismatch, not retrying')
      return false
    }

    if (message.includes('404')) {
      warn('Commit lag, retrying')
      return true
    }

    // out of gas fails immediately
    if (message.includes('out of gas')) {
      warn('Out of gas, not retrying')
      return false
    }

    // account sequence mismatches are retried
    if (message.includes('account sequence mismatch')) {
      warn('Nonce lag, retrying')
      return true
    }

    // tx failures are thrown
    if (message.includes('failed')) {
      warn('TX failed, not retrying')
      return false
    }

    // all other errors are retried
    if (!isActuallyOk) {
      warn('Fetching tx result failed, retrying')
    } else {
      //console.info('[@fadroma/scrt] Fetching tx result succeeded')
    }
    return true

  }

}

function parseAxiosError (err) {
  // use the error message sent from server, not default 500 msg
  if (err.response?.data) {
    let errorText
    const data = err.response.data
    // expect { error: string }, but otherwise dump
    if (data.error && typeof data.error === "string") {
      errorText = data.error
    } else if (typeof data === "string") {
      errorText = data
    } else {
      errorText = JSON.stringify(data)
    }
    throw new Error(`${errorText} (HTTP ${err.response.status})`)
  } else {
    throw err
  }
}
