/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Uint128 } from '../deps.ts'
import { Error } from './tmLog.ts'
/** Represents some amount of native token. */
export interface Coin { readonly amount: string, readonly denom: string }
/** Convert to coin. */
export const makeCoin = (amount: Uint128, denom: string): Coin => ({ amount: String(amount), denom })
/** A gas fee, payable in native tokens. */
export interface Fee { readonly gas: Uint128, readonly amount: Coin[] }
/** Convert to fee. */
export const makeFee = (gas: Uint128, amount: Coin[]): Fee => ({ gas: String(gas), amount })
/** A mapping of transaction type to default fee in one or more tokens. */
export type FeeMap<T extends string> = { [key in T]: Fee }
export type Token       = { readonly id: string }
export type NativeToken = Token & { denom: string }
export type CustomToken = Token & { address: Address, codeHash?: string }
export type Fungible    = Token & { fungible: true }
export type NonFungible = Token & { fungible: false }
export type TokenApi    = {
  amount: (amount: Uint128) => TokenAmount,
  fee: (gas: Uint128) => Fee
}
export const makeToken = <T extends Token> (t: T): T & TokenApi => {
  const token: any = { ...t }
  if ('fungible' in token && token.fungible) {
    const amount = (x: Uint128) => makeTokenAmount(x, token as unknown as Fungible)
    const fee    = (x: Uint128) => makeTokenAmount(x, token as unknown as Fungible).asFee(x)
    Object.assign(token, { amount, fee })
  }
  return token as T & TokenApi
}
export const makeTokenAmount = (a: Uint128, t: Fungible): TokenAmount => {
  a = String(a)
  t = makeToken(t)
  return {
    get amount () { return a },
    get token  () { return t },
    get denom  (): string|undefined { return ('denom' in t) ? t.denom as string : undefined },
    get asNativeBalance (): Coin[] { return [this.asCoin] },
    get asCoin (): Coin {
      if ('denom' in t) return makeCoin(a, t.denom as string)
      throw new Error('not a native token')
    },
    asFee (gas: Uint128): Fee {
      if ('denom' in t) return makeFee(gas, this.asNativeBalance)
      throw new Error('not a native token')
    },
    toString () { return `${a} ${t.id}` },
  }
}
/** An amount of a fungible token. */
export type TokenAmount = {
  readonly amount: Uint128,
  readonly token:  Fungible,
  readonly denom: string|undefined
  readonly asNativeBalance: Coin[]
  readonly asCoin: Coin
  asFee (gas: Uint128): Fee
  toString (): string
}

export const addZeros = (n: number|Uint128, z: number): Uint128 =>
  `${n}${[...Array(z)].map(() => '0').join('')}`

/** A pair of equivalent things. */
export type Pair<T> = [T, T]
/** Reverse a pair. */
export const reverse = <T> (pair: Pair<T>): Pair<T> => [pair[1], pair[0]]
/** A pair of tokens. */
export type TokenPair = Pair<Token>
/** A swap. */
export type Swap = Pair<SwapSide>
/** One side of a swap may contain one or more FT amounts or NFTs. */
export type SwapSide = TokenAmount|NonFungible|Array<(TokenAmount|NonFungible)>
