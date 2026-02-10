/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Tendermint, bold, camelize, base64, randomBase64 } from '../deps.ts'
import type { CosmWasm, Uint128, Address } from '../deps.ts'
import type { Chain, Console } from './scrt.ts'
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
  address: Address
  /** THe code hash of the token contract. */
  codeHash?: CosmWasm.CodeHash
  /** The total supply of the token. */
  totalSupply: Uint128
}
export type Snip20Context = CosmWasm.ClientApi & {
  id:     string,
  chain?: Chain,
  agent?: { address?: Address },
  log:    Console,
}
export type Snip20InitMsg = Snip20Config & {
  /** The admin of the token. */
  admin: Address
  /** The PRNG seed for the token. */
  prng_seed: string
  /** The settings for the token. */
  config: {
    enable_mint?: boolean
    enable_burn?: boolean
    enable_redeem?: boolean
    enable_deposit?: boolean
    public_total_supply?: boolean
  }
  /** Initial balances. */
  initial_balances?: {address: Address, amount: Uint128}[]
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
  create (_: Snip20Context, entropy?: unknown): Promise<Uint8Array>
  set (_: Snip20Context, key: ViewingKey): Promise<void>
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
  sendFrom (owner: Address, amount: Uint128, recipient: string,
            hash?: CosmWasm.CodeHash, msg?: string, memo?: string): Promise<unknown>
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
const fetchMetadata = async (deps: Snip20Context) => {
  const info: { codeHash?: CosmWasm.CodeHash } = {}
  const { address, chain, codeHash } = deps
  if (!address) throw new Error("can't fetch metadata without contract address")
  if (!chain) throw new Error("can't fetch metadata without agent")
  const setCodeHash = ({codeHash}: {codeHash?: CosmWasm.CodeHash}) => info.codeHash = codeHash
  const setMetadata = ({name, symbol, decimals, total_supply}: Snip20TokenInfo) =>
      Object.assign(info, camelize({ name, symbol, decimals, total_supply }))
  return Promise.all([
    deps.fetchContractInfo(deps.address).then(setCodeHash),
    fetchTokenInfo(deps).then(setMetadata)
  ])
}
const fetchTokenInfo = async ({ querySelf }: Snip20Context) => {
  const msg = { token_info: {} }
  const { token_info }: { token_info: Snip20TokenInfo } = await querySelf(msg)
  return token_info
}
const fetchBalance = async ({ querySelf }: Snip20Context, address: Address, key: string) => {
  const msg = { balance: { address, key } }
  const response: { balance: { amount: Uint128 } } = await querySelf(msg)
  if (response.balance && response.balance.amount) {
    return response.balance.amount
  } else {
    throw new Error(JSON.stringify(response))
  }
}
const changeAdmin = ({ execSelf }: Snip20Context, address: string) =>
  execSelf({ change_admin: { address } })
const setMinters = ({ execSelf }: Snip20Context, minters: Array<string>) =>
  execSelf({ set_minters: { minters } })
const addMinters = ({ execSelf }: Snip20Context, minters: Array<string>) =>
  execSelf({ add_minters: { minters } })
const mint = ({ execSelf, agent }: Snip20Context, amount: Uint128, recipient: string|undefined = agent?.address) => {
  if (!recipient) throw new Error('Snip20#mint: specify recipient')
  return execSelf({ mint: { amount: String(amount), recipient } })
}
const burn = ({ execSelf }: Snip20Context, amount: Uint128, memo?: string) =>
  execSelf({ burn: { amount: String(amount), memo } })
const deposit = ({ execSelf }: Snip20Context, nativeToken: Tendermint.Coin[]) =>
  execSelf({ deposit: {} }, { send: nativeToken })
const redeem = ({ execSelf }: Snip20Context, amount: Uint128, denom?: string) =>
  execSelf({ redeem: { amount: String(amount), denom } })
const fetchAllowance = async (
  { querySelf }: Snip20Context, owner: Address, spender: Address, key: string
): Promise<Snip20Allowance> => {
  const response: { allowance: Snip20Allowance } = await querySelf({allowance: {owner, spender, key}})
  return response.allowance
}
const checkAllowance = ({ querySelf }: Snip20Context, spender: string, owner: string, key: string) =>
  querySelf({ check_allowance: { owner, spender, key } })
const increaseAllowance = ({ execSelf, log, agent, id }: Snip20Context, spender: Address, amount: Uint128) => {
  const address = bold(agent?.address||'(missing address)')
  log.debug(
    `${address}: increasing allowance of`, bold(spender),
    'by', bold(String(amount)), bold(String(id))
  )
  return execSelf({ increase_allowance: { amount: String(amount), spender } })
}
const decreaseAllowance = ({ execSelf }: Snip20Context, amount: Uint128, spender: Address) =>
  execSelf({ decrease_allowance: { amount: String(amount), spender } })
const transfer = ({ execSelf }: Snip20Context, amount: Uint128, recipient: Address) =>
  execSelf({ transfer: { amount, recipient } })
const transferFrom = ({ execSelf }: Snip20Context, owner: Address, recipient: Address, amount: Uint128, memo?: string) =>
  execSelf({ transfer_from: { owner, recipient, amount, memo } })
const send = (
  { execSelf }: Snip20Context, amount: Uint128, recipient: Address, callback?: string|object
) => execSelf({ send: {
  amount, recipient, msg: callback ? base64.encode(new TextEncoder().encode(JSON.stringify(callback))) : undefined
} })
const sendFrom = (
  { execSelf }: Snip20Context,
  owner: Address, amount: Uint128, recipient: String,
  hash?: CosmWasm.CodeHash, msg?: string, memo?: string
) => execSelf({ send_from: { owner, recipient, recipient_code_hash: hash, amount, msg, memo } })
const vk = (): ViewingKeyClient => ({
  /** Assign a user-specified viewing key. */
  set: ({ execSelf }: Snip20Context, key: ViewingKey) =>
    execSelf({ set_viewing_key: { key } }),
  /** Assign a random viewing key and return it to the user. */
  create: async ({ execSelf }: Snip20Context, entropy = randomBase64()) => {
    const msg = { create_viewing_key: { entropy, padding: null } }
    let { data } = await execSelf(msg) as { data: Uint8Array|Uint8Array[] }
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
