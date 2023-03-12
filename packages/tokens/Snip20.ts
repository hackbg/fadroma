import type { Agent, Address, CodeHash, Uint128, ICoin } from '@fadroma/core'
import { Client, ClientConsole, } from '@fadroma/core'
import type { Permit } from '@fadroma/scrt'
import { ViewingKeyClient } from '@fadroma/scrt'
import { randomBase64 } from '@hackbg/4mat'
import { bold, colors } from '@hackbg/logs'
import type { Token, CustomToken } from './Token'

/** # Secret Network SNIP20 token client. */

export interface Snip20BaseConfig {
  name:     string
  symbol:   string
  decimals: number
}

export interface Snip20InitMsg extends Snip20BaseConfig {
  admin:     Address
  prng_seed: string
  config:    Snip20InitConfig
  // Allow to be cast as Record<string, unknown>:
  [name: string]: unknown
}

export interface Snip20InitConfig {
  public_total_supply?: boolean
  enable_mint?:         boolean
  enable_burn?:         boolean
  enable_deposit?:      boolean
  enable_redeem?:       boolean
  // Allow unknown properties:
  [name: string]:       unknown
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

export default class Snip20 extends Client implements CustomToken {

  /** Create a SNIP20 token client from a Token descriptor. */
  static fromDescriptor (agent: Agent, descriptor: CustomToken): Snip20 {
    const { custom_token } = descriptor
    const { contract_addr: address, token_code_hash: codeHash } = custom_token
    return new Snip20(agent, address, codeHash)
  }

  /** Create a SNIP20 init message. */
  static init = (
    name:     string,
    symbol:   string,
    decimals: number,
    admin:    Address|{ address: Address },
    config:   Partial<Snip20InitConfig> = {},
    balances: Array<{address: Address, amount: Uint128}> = []
  ): Snip20InitMsg => {
    if (typeof admin === 'object') admin = admin.address
    return {
      name,
      symbol,
      decimals,
      admin,
      config,
      initial_balances: balances,
      prng_seed:        randomBase64(),
    }
  }

  log = new ClientConsole('@fadroma/tokens: Snip20')

  /** @returns the address and code hash of this token in the format
    * required by the Factory to create a swap pair with this token */
  get custom_token () {
    if (!this.address)  throw new Error("Can't create token reference without address.")
    if (!this.codeHash) throw new Error("Can't create token reference without code hash.")
    return {
      contract_addr:   this.address,
      token_code_hash: this.codeHash
    }
  }

  /** @returns self as plain CustomToken with a *hidden (from serialization!)*
    * `client` property pointing to `this`. */
  get asDescriptor () {
    return Object.defineProperty({
      custom_token: this.custom_token as any,
      client:       this as any
    }, 'client', {
      enumerable: false
    })
  }

  tokenName:   string  | null = null

  symbol:      string  | null = null

  decimals:    number  | null = null

  totalSupply: Uint128 | null = null

  async populate (): Promise<this> {
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
    return this.execute({ add_minters: { minters } })
  }

  /** Mint SNIP20 tokens */
  mint (amount: string | number | bigint, recipient: string | undefined = this.agent?.address) {
    if (!recipient) {
      throw new Error('Snip20#mint: specify recipient')
    }
    return this.execute({ mint: { amount: String(amount), recipient } })
  }

  /** Burn SNIP20 tokens */
  burn (amount: string | number | bigint, memo?: string) {
    return this.execute({ burn: { amount: String(amount), memo } })
  }

  /** Deposit native tokens into the contract. */
  deposit (nativeTokens: ICoin[],) {
    return this.execute({ deposit: {} }, { send: nativeTokens })
  }

  /** Redeem an amount of a native token from the contract. */
  redeem (amount: string | number | bigint, denom?: string) {
    return this.execute({ redeem: { amount: String(amount), denom } })
  }

  /** Get the current allowance from `owner` to `spender` */
  async getAllowance (owner: Address, spender: Address, key: string): Promise<Allowance> {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Allowance } = await this.query(msg)
    return response.allowance
  }

  /** Check the current allowance from `owner` to `spender`. */
  checkAllowance (spender: string, owner: string, key: string) {
    return this.query({ check_allowance: { owner, spender, key } })
  }

  /** Increase allowance to spender */
  increaseAllowance (amount:  string | number | bigint, spender: Address) {
    this.log.debug(
      `${bold(this.agent?.address||'(missing address)')}: increasing allowance of`,
      bold(spender), 'by', bold(String(amount)), bold(String(this.symbol||this.address))
    )
    return this.execute({ increase_allowance: { amount: String(amount), spender } })
  }

  /** Decrease allowance to spender */
  decreaseAllowance (amount: string | number | bigint, spender: Address) {
    return this.execute({ decrease_allowance: { amount: String(amount), spender } })
  }

  /** Transfer tokens to address */
  transfer (amount: string | number | bigint, recipient: Address) {
    return this.execute({ transfer: { amount, recipient } })
  }

  batchTransfer (actions: TransferAction[]) {
    return this.execute({ batch_transfer: { actions } })
  }

  transferFrom (owner: Address, recipient: Address, amount: Uint128, memo?: string) {
    return this.execute({ transfer_from: { owner, recipient, amount, memo } })
  }

  batchTransferFrom (actions: TransferFromAction[]) {
    return this.execute({ batch_transfer_from: { actions } })
  }

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send (amount: string | number | bigint, recipient: Address, callback?: string | object) {
    return this.execute({ send: { amount, recipient, msg: this.encode(callback) } })
  }

  /** Convert to base 64 */
  encode (callback?: string|object): string|undefined {
    return callback
      ? Buffer.from(JSON.stringify(callback)).toString('base64')
      : undefined
  }

  batchSend (actions: SendAction[]) {
    return this.execute({ batch_transfer: { actions } })
  }

  sendFrom (
    owner:     Address,
    amount:    Uint128,
    recipient: String,
    hash?:     CodeHash,
    msg?:      string,
    memo?:     string
  ) {
    return this.execute({
      send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo }
    })
  }

  batchSendFrom (actions: SendFromAction[]) {
    return this.execute({ batch_send_from: { actions } })
  }

  /** Get a client to the Viewing Key API. */
  get vk (): ViewingKeyClient {
    return new ViewingKeyClient(this.agent, this.address, this.codeHash)
  }

}

export interface TransferAction {
  recipient: Address
  amount:    Uint128
  memo?:     string
}

export interface TransferFromAction {
  owner:     Address
  recipient: Address
  amount:    Uint128
  memo?:     string
}

export interface SendAction {
  recipient:            Address
  recipient_code_hash?: CodeHash
  amount:               Uint128
  msg?:                 string
  memo?:                string
}

export interface SendFromAction {
  owner:                Address
  recipient_code_hash?: CodeHash
  recipient:            Address
  amount:               Uint128
  msg?:                 string
  memo?:                string
}
