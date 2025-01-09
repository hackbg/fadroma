/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Token, bold, randomBase64 } from '../deps.ts'
import type { CosmWasm, Uint128, Address } from '../deps.ts'
import type { Permit } from './snip24.ts'

export type Snip20 = {
  /** The address of the token contract. */
  address:     Address
  /** THe code hash of the token contract. */
  codeHash?:   CosmWasm.CodeHash
  /** The full name of the token. */
  name:        string
  /** The market symbol of the token. */
  symbol:      string
  /** The decimal precision of the token. */
  decimals:    number
  /** The total supply of the token. */
  totalSupply: Uint128
}

export interface Snip20Api {
  /** Get a comparable token ID. */
  readonly id: string
  /** Get a client to the Viewing Key API. */
  readonly vk: ViewingKeyClient
  /** @returns true */
  isFungible(): true
  /** @returns true */
  isCustom(): true
  /** @returns false */
  isNative(): false
  fetchMetadata(): Promise<this>
  fetchTokenInfo(): Promise<Snip20TokenInfo>
  fetchBalance(address: Address, key: string): Promise<Uint128>
  /** Change the admin of the token, who can set the minters */
  changeAdmin(address: string): Promise<unknown>
  /** Set specific addresses to be minters, remove all others */
  setMinters(minters: Array<string>): Promise<unknown>
  /** Add addresses to be minters */
  addMinters(minters: Array<string>): Promise<unknown>
  /** Mint SNIP20 tokens */
  mint(amount: Uint128, recipient: string|undefined): Promise<unknown>
  /** Burn SNIP20 tokens */
  burn(amount: Uint128, memo?: string): Promise<unknown>
  /** Deposit native tokens into the contract. */
  deposit(nativeToken: Token.Coin[]): Promise<unknown>
  /** Redeem an amount of a native token from the contract. */
  redeem(amount: Uint128, denom?: string): Promise<unknown>
  /** Get the current allowance from `owner` to `spender` */
  fetchAllowance(owner: Address, spender: Address, key: string): Promise<Snip20Allowance>
  /** Check the current allowance from `owner` to `spender`. */
  checkAllowance(spender: string, owner: string, key: string): Promise<unknown>
  /** Increase allowance to spender */
  increaseAllowance (amount: string|number|bigint, spender: Address): Promise<unknown>
  /** Decrease allowance to spender */
  decreaseAllowance (amount: string|number|bigint, spender: Address): Promise<unknown>
  /** Transfer tokens to address */
  transfer (amount: Uint128, recipient: Address): Promise<unknown>
  transferFrom (owner: Address, recipient: Address, amount: Uint128, memo?: string): Promise<unknown>
  /** Send tokens to address.
    * Same as transfer but allows for receive callback. */
  send (amount: Uint128, recipient: Address, callback?: string|object): Promise<unknown>
  sendFrom (
    owner: Address, amount: Uint128, recipient: String,
    hash?: CosmWasm.CodeHash, msg?: string, memo?: string
  ): Promise<unknown>
  batchTransfer (actions: TransferAction[]): Promise<unknown>
  batchTransferFrom (actions: TransferFromAction[]): Promise<unknown>
  batchSend (actions: SendAction[]): Promise<unknown>
  batchSendFrom (actions: SendFromAction[]): Promise<unknown>
  amount (amount: Uint128): Token.Amount
}
/** Create a SNIP20 init message. */
export const initSnip20 = ({
  symbol, decimals, admin,
  name = symbol, config = {},
  balances = [], prngSeed = randomBase64()
}: {
  symbol: string, decimals: number, admin: Address|{ address: Address },
  name?: string, config?: Partial<Snip20InitMsg["config"]>,
  balances?: Array<{address: Address, amount: Uint128}>, prngSeed?: string
}): Snip20InitMsg => {
  if (admin && (typeof admin === 'object')) {
    admin = admin.address
  }
  return {
    name,
    symbol,
    decimals,
    admin: admin as Address,
    config,
    initial_balances: balances,
    prng_seed: prngSeed,
  }
}
export interface Snip20InitMsg extends Snip20BaseConfig {
  /** The admin of the token. */
  admin: Address
  /** The PRNG seed for the token. */
  prng_seed: string
  /** The settings for the token. */
  config: {
    public_total_supply?: boolean
    enable_mint?: boolean
    enable_burn?: boolean
    enable_deposit?: boolean
    enable_redeem?: boolean
    // Allow unknown properties:
    [name: string]: unknown
  }
  /** Initial balances. */
  initial_balances?: {address: Address, amount: Uint128}[]
  // Allow to be cast as Record<string, unknown>:
  [name: string]: unknown
}
export const snip20Impl = {
  get id () { return this.address! },
  get vk (): ViewingKeyClient { return new ViewingKeyClient(this) },
  isFungible: () => true,
  isCustom:   () => true,
  isNative:   () => false,
  fetchMetadata: async (): Promise<this> => {
    if (!this.chain) {
      throw new Error("can't fetch metadata without agent")
    }
    if (!this.instance || !this.instance.address) {
      throw new Error("can't fetch metadata without contract address")
    }
    return Promise.all([
      this.chain.fetchContractInfo(this.instance.address).then(({codeHash}) =>
        this.instance!.codeHash = codeHash),
      this.fetchTokenInfo().then(({ name, symbol, decimals, total_supply }: Snip20TokenInfo) =>
        Object.assign(this, { name, symbol, decimals, total_supply }))
    ]).then(()=>this)
  },
  fetchTokenInfo: async () => {
    const msg = { token_info: {} }
    const { token_info }: { token_info: Snip20TokenInfo } = await this.query(msg)
    return token_info
  },
  fetchBalance: async (address: Address, key: string) => {
    const msg = { balance: { address, key } }
    const response: { balance: { amount: Uint128 } } = await this.query(msg)
    if (response.balance && response.balance.amount) {
      return response.balance.amount
    } else {
      throw new Error(JSON.stringify(response))
    }
  },
  changeAdmin: (address: string) => this.execute({ change_admin: { address } }),
  setMinters: (minters: Array<string>) => this.execute({ set_minters: { minters } }),
  addMinters: (minters: Array<string>) => this.execute({ add_minters: { minters } }),
  mint: (amount: Uint128, recipient: string|undefined = this.agent?.address) => {
    if (!recipient) throw new Error('Snip20#mint: specify recipient')
    return this.execute({ mint: { amount: String(amount), recipient } })
  },
  burn: (amount: Uint128, memo?: string) =>
    this.execute({ burn: { amount: String(amount), memo } }),
  deposit: (nativeToken: Token.ICoin[]) =>
    this.execute({ deposit: {} }, { execSend: nativeToken }),
  redeem: (amount: Uint128, denom?: string) =>
    this.execute({ redeem: { amount: String(amount), denom } }),
  fetchAllowance: async (owner: Address, spender: Address, key: string): Promise<Snip20Allowance> => {
    const msg = { allowance: { owner, spender, key } }
    const response: { allowance: Snip20Allowance } = await this.query(msg)
    return response.allowance
  },
  checkAllowance: (spender: string, owner: string, key: string) =>
    this.query({ check_allowance: { owner, spender, key } }),
  increaseAllowance: (amount: Uint128, spender: Address) => {
    this.log.debug(
      `${bold(this.agent?.address||'(missing address)')}: increasing allowance of`,
      bold(spender), 'by', bold(String(amount)), bold(String(this.symbol||this.instance?.address))
    )
    return this.execute({ increase_allowance: { amount: String(amount), spender } })
  },
  decreaseAllowance: (amount: Uint128, spender: Address) =>
    this.execute({ decrease_allowance: { amount: String(amount), spender } }),
  transfer: (amount: Uint128, recipient: Address) =>
    this.execute({ transfer: { amount, recipient } }),
  transferFrom: (owner: Address, recipient: Address, amount: Uint128, memo?: string) =>
    this.execute({ transfer_from: { owner, recipient, amount, memo } }),
  send: (amount: Uint128, recipient: Address, callback?: string|object) => this.execute({
    send: {
      amount, recipient,
      msg: callback ? Buffer.from(JSON.stringify(callback)).toString('base64') : undefined
    }
  }),
  sendFrom: (
    owner: Address, amount: Uint128, recipient: String,
    hash?: CosmWasm.CodeHash, msg?: string, memo?: string
  ) => this.execute({
    send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo }
  }),
  batchTransfer: (actions: TransferAction[]) =>
    this.execute({ batch_transfer: { actions } }),
  batchTransferFrom: (actions: TransferFromAction[]) =>
    this.execute({ batch_transfer_from: { actions } }),
  batchSend: (actions: SendAction[]) =>
    this.execute({ batch_transfer: { actions } }),
  batchSendFrom: (actions: SendFromAction[]) =>
    this.execute({ batch_send_from: { actions } }),
  //amount: (amount: Uint128): Token.Amount =>
    //new Token.Amount(amount, this),
}

export interface Snip20BaseConfig {
  /** The full name of the token. */
  name: string
  /** The market symbol of the token. */
  symbol: string
  /** The decimal precision of the token. */
  decimals: number
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
  recipient_code_hash?: CosmWasm.CodeHash
  amount:               Uint128
  msg?:                 string
  memo?:                string
}

export interface SendFromAction {
  owner:                Address
  recipient_code_hash?: CosmWasm.CodeHash
  recipient:            Address
  amount:               Uint128
  msg?:                 string
  memo?:                string
}

/** A viewing key. */
export type ViewingKey = string

/** A contract's viewing key methods. */
export class ViewingKeyClient extends Contract {

  /** Create a random viewing key. */
  async create (entropy = randomBase64()) {
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
