import { Agent, Client, randomHex, decode } from '@fadroma/ops'

export class Snip20Client extends Client {

  async getTokenInfo () {
    const { token_info } = await this.query({ token_info: {} })
    return token_info
  }

  async getBalance (address: string, key: string) {
    const response = await this.query({ balance: { address, key } })
    if (response.balance && response.balance.amount) {
      return response.balance.amount
    } else {
      throw new Error(JSON.stringify(response))
    }
  }

  checkAllowance (spender: string, owner: string, key: string) {
    return this.query({ check_allowance: { owner, spender, key } })
  }

  /** Change the admin of the token, who can set the minters */
  changeAdmin (address: string) {
    return this.execute({
      change_admin: { address }
    })
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters (minters: Array<string>) {
    return this.execute({
      set_minters: { minters }
    })
  }

  /** Add addresses to be minters */
  addMinters (minters: Array<string>) {
    return this.execute({
      add_minters: { minters, padding: null }
    })
  }

  /** Mint tokens */
  mint (
    amount:    string | number | bigint,
    recipient: string = this.agent.address
  ) {
    console.log(1)
    return this.execute({
      mint: { amount: String(amount), recipient, padding: null }
    })
  }

  /** Create viewing key for the agent */
  createViewingKey (entropy = randomHex(32)) {
    return this.execute({
      create_viewing_key: { entropy, padding: null }
    }).then((tx) => ({
      tx,
      key: JSON.parse(decode(tx.data)).create_viewing_key.key,
    }))
  }

  /** Set viewing key for the agent  */
  setViewingKey (key: string) {
    return this.execute({
      set_viewing_key: { key }
    }).then((tx) => ({
      tx,
      //status: JSON.parse(decode(tx.data)).set_viewing_key.key,
    }))
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    return this.execute({
      increase_allowance: { amount: String(amount), spender }
    })
  }

  /** Decrease allowance to spender */
  decreaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    return this.execute({
      decrease_allowance: { amount: String(amount), spender }
    })
  }

}
