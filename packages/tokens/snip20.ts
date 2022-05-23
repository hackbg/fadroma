import { Agent, Client, Address, Uint128 } from '@fadroma/client'
import { Permit, ViewingKeyClient } from '@fadroma/client-scrt'
import { Console } from '@hackbg/konzola'

const randomHex = () => { throw new Error('randomHex: TODO') }

const console = Console('Fadroma Tokens')

type TokenType = any // TODO

export class Snip20 extends Client {

  static async fromTokenSpec (agent: Agent, token: TokenType) {
    const TOKEN = new Snip20(agent, {
      address:  token.custom_token.contract_addr,
      codeHash: token.custom_token.token_code_hash,
    })
    const NAME = (TOKEN instanceof Snip20)
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
    const { token_info }: GetTokenInfoResponse = await this.query({ token_info: {} })
    return token_info
  }

  async getBalance (address: string, key: string) {
    const response: GetBalanceResponse = await this.query({ balance: { address, key } })
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
  changeAdmin <R> (address: string): Promise<R> {
    return this.execute({ change_admin: { address } })
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters <R> (minters: Array<string>): Promise<R> {
    return this.execute({ set_minters: { minters } })
  }

  /** Add addresses to be minters */
  addMinters <R> (minters: Array<string>): Promise<R> {
    return this.execute({
      add_minters: { minters, padding: null }
    })
  }

  /** Mint tokens */
  mint <R> (
    amount:    string | number | bigint,
    recipient: string | undefined = this.agent.address
  ): Promise<R> {
    if (!recipient) {
      throw new Error('Snip20#mint: specify recipient')
    }
    return this.execute({
      mint: { amount: String(amount), recipient, padding: null }
    })
  }

  async getAllowance (owner: Address, spender: Address, key: string): Promise<Allowance> {
    return (await this.query({
      allowance: { owner, spender, key }
    }) as GetAllowanceResponse).allowance
  }

  /** Increase allowance to spender */
  increaseAllowance <R> (
    amount:  string | number | bigint,
    spender: string,
  ): Promise<R> {
    return this.execute({
      increase_allowance: { amount: String(amount), spender }
    })
  }

  /** Decrease allowance to spender */
  decreaseAllowance <R> (
    amount:  string | number | bigint,
    spender: string,
  ): Promise<R> {
    return this.execute({
      decrease_allowance: { amount: String(amount), spender }
    })
  }

  /** Transfer tokens to address */
  transfer <R> (
    amount:    string | number | bigint,
    recipient: Address,
  ): Promise<R> {
    return this.execute({
      transfer: { amount, recipient }
    })
  }

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send <R> (
    amount:    string | number | bigint,
    recipient: Address,
    msg?:      string | object
  ): Promise<R> {
    return this.execute({
      send: { amount, recipient, msg }
    })
  }

  vk = new ViewingKeyClient(this.agent, this)

}

export interface GetAllowanceResponse {
  allowance: Allowance
}

export interface Allowance {
  spender:     Address
  owner:       Address
  allowance:   Uint128
  expiration?: number|null
}

export interface GetTokenInfoResponse {
  token_info: TokenInfo
}

export interface TokenInfo {
  name:          string
  symbol:        string
  decimals:      number
  total_supply?: Uint128 | null
}

export interface GetBalanceResponse {
  balance: { amount: string }
}

export type Snip20Permit = Permit<'allowance' | 'balance' | 'history' | 'owner'>

export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }

export function create_permit_msg <Q> (
  query:  Q,
  permit: Snip20Permit
): QueryWithPermit<Q, Snip20Permit> {
  return { with_permit: { query, permit } }
}
