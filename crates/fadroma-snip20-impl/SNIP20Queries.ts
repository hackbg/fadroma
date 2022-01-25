import { QueryExecutor } from '@fadroma/scrt'

export class SNIP20Queries extends QueryExecutor {

  async tokenInfo () {
    const { token_info } = await this.query({ token_info: {} })
    return token_info
  }

  /** Get address balance */
  async balance (address: string, key: string) {
    const msg = { balance: { address, key } }
    const response = await this.query(msg)
    if (response.balance && response.balance.amount) {
      return response.balance.amount
    } else {
      throw new Error(JSON.stringify(response))
    }
  }

  /** Check available allowance */
  checkAllowance (spender: string, owner: string, key: string) {
    const msg = { owner, spender, key }
    return this.query(msg)
  }

}
