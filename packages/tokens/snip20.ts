import { Address, Client, Executor, Uint128 } from '@fadroma/client'
import { Permit, ViewingKeyClient } from '@fadroma/client-scrt'
import { Console, bold } from '@hackbg/konzola'
import { CustomToken } from './descriptors'

const randomHex = () => { throw new Error('randomHex: TODO') }

const console = Console('Fadroma Tokens')

export class Snip20 extends Client {

  static fromDescriptor (agent: Executor, descriptor: CustomToken): Snip20 {
    const { custom_token } = descriptor
    const { contract_addr: address, token_code_hash: codeHash } = custom_token
    return new Snip20(agent, { address, codeHash })
  }

  /** Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token */
  get asDescriptor () {
    return {
      custom_token: {
        contract_addr:   this.address,
        token_code_hash: this.codeHash
      }
    }
  }

  tokenName:   string  | null = null
  symbol:      string  | null = null
  decimals:    number  | null = null
  totalSupply: Uint128 | null = null

  async populate () {
    await super.populate()
    const { name, symbol, decimals, total_supply } = await this.getTokenInfo()
    this.tokenName   = name
    this.symbol      = symbol
    this.decimals    = decimals
    this.totalSupply = total_supply || null
    return this
  }

  async getTokenInfo () {
    const msg = { token_info: {} }
    const { token_info }: { token_info: TokenInfo } = await this.query(msg)
    return token_info
  }

  async getBalance (address: Address, key: string) {
    const msg = { balance: { address, key } }
    const response: { balance: { amount: Uint128 } } = await this.query(msg)
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
    return this.execute({ change_admin: { address } })
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters (minters: Array<string>) {
    return this.execute({ set_minters: { minters } })
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
    recipient: string | undefined = this.agent.address
  ) {
    if (!recipient) {
      throw new Error('Snip20#mint: specify recipient')
    }
    return this.execute({
      mint: { amount: String(amount), recipient, padding: null }
    })
  }

  async getAllowance (owner: Address, spender: Address, key: string): Promise<Allowance> {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Allowance } = await this.query(msg)
    return response.allowance
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: Address,
  ) {
    console.info(
      `${bold(this.agent.address||'(missing address)')}: increasing allowance of`,
      bold(spender), 'by', bold(String(amount)), bold(String(this.symbol||this.address))
    )
    return this.execute({
      increase_allowance: { amount: String(amount), spender }
    })
  }

  /** Decrease allowance to spender */
  decreaseAllowance (
    amount:  string | number | bigint,
    spender: Address,
  ) {
    return this.execute({
      decrease_allowance: { amount: String(amount), spender }
    })
  }

  /** Transfer tokens to address */
  transfer (
    amount:    string | number | bigint,
    recipient: Address,
  ) {
    return this.execute({
      transfer: { amount, recipient }
    })
  }

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send (
    amount:    string | number | bigint,
    recipient: Address,
    callback?: string | object
  ) {
    const callbackB64 = Buffer.from(JSON.stringify(callback)).toString('base64')
    const msg = { send: { amount, recipient, msg: callbackB64 } }
    return this.execute(msg)
  }

  vk = new ViewingKeyClient(this.agent, this)

}

export interface Allowance {
  spender:     Address
  owner:       Address
  allowance:   Uint128
  expiration?: number|null
}

export interface TokenInfo {
  name:          string
  symbol:        string
  decimals:      number
  total_supply?: Uint128 | null
}

export type Snip20Permit = Permit<'allowance' | 'balance' | 'history' | 'owner'>

export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }

export function createPermitMsg <Q> (
  query:  Q,
  permit: Snip20Permit
): QueryWithPermit<Q, Snip20Permit> {
  return { with_permit: { query, permit } }
}
