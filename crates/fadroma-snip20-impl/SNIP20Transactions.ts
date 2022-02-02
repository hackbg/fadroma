import { TransactionExecutor, randomHex, decode } from '@fadroma/scrt'

// @ts-ignore
//const decoder = new TextDecoder();
//const decode = (buffer: any) => decoder.decode(buffer).trim();

export class SNIP20Transactions extends TransactionExecutor {

  /** Change admin of the token */
  changeAdmin (address: string) {
    const msg = { change_admin: { address } }
    return this.execute(msg)
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters (minters: Array<string>) {
    const msg = { set_minters: { minters } }
    return this.execute(msg)
  }

  /** Add addresses to be minters */
  addMinters (minters: Array<string>) {
    const msg = { add_minters: { minters, padding: null } }
    return this.execute(msg)
  }

  /** Mint tokens */
  mint (
    amount:    string | number | bigint,
    recipient: string = this.agent.address
  ) {
    const msg = { mint: { amount: String(amount), recipient, padding: null } }
    return this.execute(msg).then((tx) => {
      //console.debug('WTF is going on here - TX data returned as hex string instead of buffer - why do we need the tx data anyway:', tx)
      return { tx/*, mint: JSON.parse(decode(tx.data)).mint*/ }
    })
  }

  /** Create viewing key for the agent */
  createViewingKey (entropy = randomHex(32)) {
    const msg = { create_viewing_key: { entropy, padding: null } }
    return this.execute(msg).then((tx) => ({
      tx,
      key: JSON.parse(decode(tx.data)).create_viewing_key.key,
    }))
  }

  /** Set viewing key for the agent  */
  setViewingKey (key: string) {
    const msg = { set_viewing_key: { key } }
    return this.execute(msg).then((tx) => ({
      tx,
      //status: JSON.parse(decode(tx.data)).set_viewing_key.key,
    }))
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    const msg = { increase_allowance: { amount: String(amount), spender } }
    return this.execute(msg)
  }

  /** Decrease allowance to spender */
  decreaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    const msg = { decrease_allowance: { amount: String(amount), spender } }
    return this.execute(msg)
  }

}
