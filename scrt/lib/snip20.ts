/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Tendermint, bold, base64, randomBase64 } from '../deps.ts'
import type { CosmWasm, Uint128, Address } from '../deps.ts'
import type { Console } from './scrt.ts'
export type Snip20Config = {
  /** The full name of the token. */
  name: string
  /** The market symbol of the token. */
  symbol: string
  /** The decimal precision of the token. */
  decimals: number
}
export type Snip20 = Snip20Config & {
  /** The address of the token contract. */
  address:     Address
  /** THe code hash of the token contract. */
  codeHash?:   CosmWasm.CodeHash
  /** The total supply of the token. */
  totalSupply: Uint128
}
export type Snip20InitMsg = Snip20Config & {
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
export type Snip20Allowance = {
  spender: Address
  owner: Address
  allowance: Uint128
  expiration?: number|null
}
export type Snip20TokenInfo = {
  name: string
  symbol: string
  decimals: number
  total_supply?: Uint128|null
}
/** A viewing key. */
export type ViewingKey = string
/** A contract's viewing key methods. */
export type ViewingKeyClient = {
  create (_: Snip20Deps, entropy?: any): Promise<Uint8Array>
  set (_: Snip20Deps, key: ViewingKey): Promise<void>
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
  deposit(nativeToken: Tendermint.Coin[]): Promise<unknown>
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
  amount (amount: Uint128): Tendermint.Amount
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
export type Snip20Deps = CosmWasm.Deps & {
  id:       string,
  address?: Address,
  chain?:   Chain,
  agent:    { address?: Address },
  log:      Console,
}
const fetchMetadata = async (deps: Snip20Deps): Promise<deps> => {
  if (!deps || !deps.address) {
    throw new Error("can't fetch metadata without contract address")
  }
  if (!deps.chain) {
    throw new Error("can't fetch metadata without agent")
  }
  return Promise.all([
    deps.chain.fetchContractInfo(deps.address).then(({codeHash}) =>
      deps.codeHash = codeHash),
    deps.fetchTokenInfo().then(({ name, symbol, decimals, total_supply }: Snip20TokenInfo) =>
      Object.assign(deps, { name, symbol, decimals, total_supply }))
  ]).then(()=>deps)
}
const fetchTokenInfo = async ({ query }: Snip20Deps) => {
  const msg = { token_info: {} }
  const { token_info }: { token_info: Snip20TokenInfo } = await query(msg)
  return token_info
}
const fetchBalance = async ({ query }: Snip20Deps, address: Address, key: string) => {
  const msg = { balance: { address, key } }
  const response: { balance: { amount: Uint128 } } = await query(msg)
  if (response.balance && response.balance.amount) {
    return response.balance.amount
  } else {
    throw new Error(JSON.stringify(response))
  }
}
const changeAdmin = ({ execute }: Snip20Deps, address: string) =>
  execute({ change_admin: { address } })
const setMinters = ({ execute }: Snip20Deps, minters: Array<string>) =>
  execute({ set_minters: { minters } })
const addMinters = ({ execute }: Snip20Deps, minters: Array<string>) =>
  execute({ add_minters: { minters } })
const mint = ({ execute, agent }: Snip20Deps, amount: Uint128, recipient: string|undefined = agent?.address) => {
  if (!recipient) throw new Error('Snip20#mint: specify recipient')
  return execute({ mint: { amount: String(amount), recipient } })
}
const burn = ({ execute }: Snip20Deps, amount: Uint128, memo?: string) =>
  execute({ burn: { amount: String(amount), memo } })
const deposit = ({ execute }: Snip20Deps, nativeToken: Tendermint.Coin[]) =>
  execute({ deposit: {} }, { execSend: nativeToken })
const redeem = ({ execute }: Snip20Deps, amount: Uint128, denom?: string) =>
  execute({ redeem: { amount: String(amount), denom } })
const fetchAllowance = async ({ query }: Snip20Deps, owner: Address, spender: Address, key: string): Promise<Snip20Allowance> => {
  const response: { allowance: Snip20Allowance } = await query({ allowance: { owner, spender, key } })
  return response.allowance
}
const checkAllowance = ({ query }: Snip20Deps, spender: string, owner: string, key: string) =>
  query({ check_allowance: { owner, spender, key } })
const increaseAllowance = ({ execute, log, agent, id }: Snip20Deps, spender: Address, amount: Uint128) => {
  const address = bold(agent?.address||'(missing address)')
  log.debug(
    `${address}: increasing allowance of`, bold(spender),
    'by', bold(String(amount)), bold(String(id))
  )
  return execute({ increase_allowance: { amount: String(amount), spender } })
}
const decreaseAllowance = ({ execute }: Snip20Deps, amount: Uint128, spender: Address) =>
  execute({ decrease_allowance: { amount: String(amount), spender } })
const transfer = ({ execute }: Snip20Deps, amount: Uint128, recipient: Address) =>
  execute({ transfer: { amount, recipient } })
const transferFrom = ({ execute }: Snip20Deps, owner: Address, recipient: Address, amount: Uint128, memo?: string) =>
  execute({ transfer_from: { owner, recipient, amount, memo } })
const send = ({ execute }: Snip20Deps, amount: Uint128, recipient: Address, callback?: string|object) =>
  execute({
    send: { amount, recipient, msg: callback ? base64.encode(JSON.stringify(callback)) : undefined }
  })
const sendFrom = (
  { execute }: Snip20Deps,
  owner: Address, amount: Uint128, recipient: String,
  hash?: CosmWasm.CodeHash, msg?: string, memo?: string
) => execute({ send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo } })
const vk = (): ViewingKeyClient => ({
  /** Assign a user-specified viewing key. */
  set: ({ execute }: Snip20Deps, key: ViewingKey) =>
    execute({ set_viewing_key: { key } }),
  /** Assign a random viewing key and return it to the user. */
  create: async ({ execute }: Snip20Deps, entropy = randomBase64()) => {
    const msg = { create_viewing_key: { entropy, padding: null } }
    let { data } = await execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) {
      return data
    } else {
      return data[0]
    }
  },
})
export const snip20Impl = {
  //get id () { return this.address! },
  //isFungible: () => true,
  //isCustom:   () => true,
  //isNative:   () => false,
  fetchMetadata,
  fetchTokenInfo,
  fetchBalance,
  changeAdmin,
  setMinters,
  addMinters,
  mint,
  burn,
  deposit,
  redeem,
  fetchAllowance,
  checkAllowance,
  increaseAllowance,
  decreaseAllowance,
  transfer,
  transferFrom,
  send,
  sendFrom,
  vk
}
