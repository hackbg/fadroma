import { Console, Agent, Client, randomHex, decode, fromHex } from '@fadroma/ops'

const console = new Console('@fadroma/snip20/Client')

export class Snip20Client extends Client {

  static async fromTokenSpec (agent: Agent, token: TokenType) {
    const TOKEN = new Snip20Client({
      address:  token.custom_token.contract_addr,
      codeHash: token.custom_token.token_code_hash,
      agent
    })
    const NAME = (TOKEN instanceof Snip20Client)
      ? (await TOKEN.getTokenInfo()).symbol
      : 'SCRT'
    return { TOKEN, NAME }
  }

  /** Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token */
  get asCustomToken () {
    return {
      custom_token: {
        contract_addr:   this.address,
        token_code_hash: this.codeHash
      }
    }
  }

  async getTokenInfo () {
    return (await this.query({ token_info: {} })).token_info
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
    return this.execute({
      mint: { amount: String(amount), recipient, padding: null }
    })
  }

  /** Create viewing key for the agent */
  createViewingKey (entropy = randomHex(32)) {
    return this.execute({
      create_viewing_key: { entropy, padding: null }
    }).then((tx) => {
      console.warn('TODO decode response from create viewing key')
      return { tx }
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
  }

  /** Set viewing key for the agent  */
  setViewingKey (key: string) {
    return this.execute({
      set_viewing_key: { key }
    }).then((tx) => {
      console.info(tx)
      return { tx }
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
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

  /** Transfer tokens to address */
  transfer (
    amount:    string | number | bigint,
    recipient: string,
  ) {
    return this.execute({
      transfer: { amount, recipient }
    })
  }

}
