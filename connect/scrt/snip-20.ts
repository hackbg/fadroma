/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Token, ContractClient, randomBytes, randomBase64, bold, colors } from '@fadroma/agent'
import type { CodeHash, Uint128, Agent, Address } from '@fadroma/agent'
import { Console } from './scrt-base'
import type { Permit } from './snip-24'

export class Snip20 extends ContractClient implements Token.Fungible {
  log = new Console('@fadroma/tokens: Snip20')
  /** The full name of the token. */
  name: string|null = null
  /** The market symbol of the token. */
  symbol: string|null = null
  /** The decimal precision of the token. */
  decimals: number|null = null
  /** The total supply of the token. */
  totalSupply: Uint128|null = null

  /** Create a SNIP20 token client from a Token.Custom descriptor. */
  static fromDescriptor (descriptor: Token.Custom, agent?: Agent): Snip20 {
    return descriptor.connect(agent, this)
  }

  /** Create a SNIP20 init message. */
  static init (
    name:     string,
    symbol:   string,
    decimals: number,
    admin:    Address|{ address: Address },
    config:   Partial<Snip20InitConfig> = {},
    balances: Array<{address: Address, amount: Uint128}> = []
  ): Snip20InitMsg {
    if (typeof admin === 'object') admin = admin.address
    return {
      name, symbol, decimals, admin, config, initial_balances: balances, prng_seed: randomBase64(),
    }
  }

  /** Get a comparable token ID. */
  get id () {
    return this.contract.address!
  }

  /** Get a client to the Viewing Key API. */
  get vk (): ViewingKeyClient {
    return new ViewingKeyClient(this.contract, this.agent)
  }

  /** @returns self as plain Token.Custom with a *hidden (from serialization!)*
    * `client` property pointing to `this`. */
  get asDescriptor (): Token.Custom {
    return new Token.Custom(this.contract.address!, this.contract.codeHash)
  }

  /** @returns true */
  isFungible = () => true
  /** @returns true */
  isCustom = () => true
  /** @returns false */
  isNative = () => false

  async fetchMetadata (): Promise<this> {
    if (!this.agent) {
      throw new Error("can't fetch metadata without agent")
    }
    if (!this.contract || !this.contract.address) {
      throw new Error("can't fetch metadata without contract address")
    }
    return Promise.all([
      this.agent.getCodeHashOfAddress(this.contract.address).then((codeHash: CodeHash) =>
        this.contract.codeHash = codeHash),
      this.getTokenInfo().then(({ name, symbol, decimals, total_supply }: Snip20TokenInfo) =>
        Object.assign(this, { name, symbol, decimals, total_supply }))
    ]).then(()=>this)
  }

  async getTokenInfo () {
    const msg = { token_info: {} }
    const { token_info }: { token_info: Snip20TokenInfo } = await this.query(msg)
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
  changeAdmin = (address: string) =>
    this.execute({ change_admin: { address } })

  /** Set specific addresses to be minters, remove all others */
  setMinters = (minters: Array<string>) =>
    this.execute({ set_minters: { minters } })

  /** Add addresses to be minters */
  addMinters = (minters: Array<string>) =>
    this.execute({ add_minters: { minters } })

  /** Mint SNIP20 tokens */
  mint = (
    amount: string|number|bigint, recipient: string|undefined = this.agent?.address
  ) => {
    if (!recipient) {
      throw new Error('Snip20#mint: specify recipient')
    }
    return this.execute({ mint: { amount: String(amount), recipient } })
  }

  /** Burn SNIP20 tokens */
  burn = (amount: string|number|bigint, memo?: string) =>
    this.execute({ burn: { amount: String(amount), memo } })

  /** Deposit native tokens into the contract. */
  deposit = (nativeToken: Token.ICoin[]) =>
    this.execute({ deposit: {} }, { execSend: nativeToken })

  /** Redeem an amount of a native token from the contract. */
  redeem = (amount: string|number|bigint, denom?: string) =>
    this.execute({ redeem: { amount: String(amount), denom } })

  /** Get the current allowance from `owner` to `spender` */
  getAllowance = async (owner: Address, spender: Address, key: string): Promise<Snip20Allowance> => {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Snip20Allowance } = await this.query(msg)
    return response.allowance
  }

  /** Check the current allowance from `owner` to `spender`. */
  checkAllowance = (spender: string, owner: string, key: string) =>
    this.query({ check_allowance: { owner, spender, key } })

  /** Increase allowance to spender */
  increaseAllowance = (amount:  string|number|bigint, spender: Address) => {
    this.log.debug(
      `${bold(this.agent?.address||'(missing address)')}: increasing allowance of`,
      bold(spender), 'by', bold(String(amount)), bold(String(this.symbol||this.contract.address))
    )
    return this.execute({ increase_allowance: { amount: String(amount), spender } })
  }

  /** Decrease allowance to spender */
  decreaseAllowance = (amount: string|number|bigint, spender: Address) =>
    this.execute({ decrease_allowance: { amount: String(amount), spender } })

  /** Transfer tokens to address */
  transfer = (amount: string|number|bigint, recipient: Address) =>
    this.execute({ transfer: { amount, recipient } })

  transferFrom = (owner: Address, recipient: Address, amount: Uint128, memo?: string) =>
    this.execute({ transfer_from: { owner, recipient, amount, memo } })

  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send = (
    amount: string|number|bigint, recipient: Address, callback?: string|object
  ) => this.execute({
    send: {
      amount, recipient,
      msg: callback ? Buffer.from(JSON.stringify(callback)).toString('base64') : undefined
    }
  })

  sendFrom = (
    owner: Address, amount: Uint128, recipient: String,
    hash?: CodeHash, msg?: string, memo?: string
  ) => this.execute({
    send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo }
  })

  batchTransfer = (actions: TransferAction[]) =>
    this.execute({ batch_transfer: { actions } })

  batchTransferFrom = (actions: TransferFromAction[]) =>
    this.execute({ batch_transfer_from: { actions } })

  batchSend = (actions: SendAction[]) =>
    this.execute({ batch_transfer: { actions } })

  batchSendFrom = (actions: SendFromAction[]) =>
    this.execute({ batch_send_from: { actions } })
}

export interface Snip20BaseConfig {
  /** The full name of the token. */
  name: string
  /** The market symbol of the token. */
  symbol: string
  /** The decimal precision of the token. */
  decimals: number
}

export interface Snip20InitMsg extends Snip20BaseConfig {
  /** The admin of the token. */
  admin: Address
  /** The PRNG seed for the token. */
  prng_seed: string
  /** The settings for the token. */
  config: Snip20InitConfig
  /** Initial balances. */
  initial_balances?: {address: Address, amount: Uint128}[]
  // Allow to be cast as Record<string, unknown>:
  [name: string]: unknown
}

export interface Snip20InitConfig {
  public_total_supply?: boolean
  enable_mint?: boolean
  enable_burn?: boolean
  enable_deposit?: boolean
  enable_redeem?: boolean
  // Allow unknown properties:
  [name: string]: unknown
}

export interface Snip20Allowance {
  spender: Address
  owner: Address
  allowance: Uint128
  expiration?: number|null
}

export interface Snip20TokenInfo {
  name: string
  symbol: string
  decimals: number
  total_supply?: Uint128|null
}

export type Snip20Permit = Permit<'allowance'|'balance'|'history'|'owner'>

export type QueryWithPermit <Q, P> = { with_permit: { query: Q, permit: P } }

export const createPermitMsg = <Q> (query: Q, permit: Snip20Permit) =>
  ({ with_permit: { query, permit } })

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

/** A viewing key. */
export type ViewingKey = string

/** A contract's viewing key methods. */
export class ViewingKeyClient extends ContractClient {

  /** Create a random viewing key. */
  async create (entropy = randomBytes(32).toString("hex")) {
    const msg = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) {
      return data
    } else {
      return data[0]
    }
  }

  /** Set a user-specified viewing key. */
  async set (key: ViewingKey) {
    return this.execute({ set_viewing_key: { key } })
  }

}
