/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Uint128 } from '../../index.ts'

/** Represents some amount of native token. */
export interface Coin { amount: Uint128, denom: string }

/** A gas fee, payable in native tokens. */
export interface Fee { gas: Uint128, amount: readonly ICoin[] }

/** A mapping of transaction type to default fee in one or more tokens. */
export type FeeMap<T extends string> = { [key in T]: IFee }

export interface Token { readonly id: string }

export interface Fungible extends Token { fungible: true }

export interface NonFungible extends Token { fungible: false }

export const addZeros = (n: number|Uint128, z: number): Uint128 =>
  `${n}${[...Array(z)].map(() => '0').join('')}`

export function tokenAmount (token: Fungible, amount: number|Uint128): TokenAmount {
  // TODO
}

/** A pair of equivalent things. */
export type Pair<T> = [T, T]

/** A pair of tokens. */
export type TokenPair = Pair<Token>

/** A swap. */
export type Swap = Pair<SwapSide>

/** One side of a swap. */
export type SwapSide = TokenAmount|NonFungible|Array<(TokenAmount|NonFungible)>

/** Reverse a pair. */
export function reverse <T> (pair: Pair<T>): Pair<T> {
  return [pair[1], pair[0]]
}

/////////////////////////////////

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  amount: ICoin[] = []
  constructor (
    amount: Uint128|number|bigint, denom: string, public gas: string = String(amount)
  ) {
    this.add(amount, denom)
  }
  add (amount: Uint128|number|bigint, denom: string) {
    this.amount.push({ amount: String(amount), denom })
  }

  get [Symbol.toStringTag] () {
    let tag = `${this.gas}`
    if (this.amount.length > 0) {
      tag += ' ('
      tag += this.amount.map(({ amount, denom })=>{
        return `${amount} ${denom}`
      }).join('|')
      tag += ')'
    }
    return tag
  }
}

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

/** An abstract fungible token. */
abstract class FungibleToken extends Token {
  /** @returns true */
  isFungible (): this is FungibleToken { return true }
  /** Whether this token is natively supported by the chain. */
  abstract isNative (): this is NativeToken
  /** Whether this token is implemented by a smart contract. */
  abstract isCustom (): this is CustomToken

  amount (amount: number|Uint128): TokenAmount {
    return new TokenAmount(amount, this)
  }
}

/** An amount of a fungible token. */
class TokenAmount {
  public amount: Uint128
  constructor (amount: string|number|bigint, public token: FungibleToken) {
    this.amount = String(amount)
  }
  /** Pass this to send, initSend, execSend */
  get asNativeBalance (): ICoin[] {
    if (this.token.isNative()) {
      return [new Coin(this.amount, this.token.denom)]
    }
    return []
  }

  get denom () {
    return this.token?.id
  }

  get [Symbol.toStringTag] () {
    return this.toString()
  }

  toString () {
    return `${this.amount??''} ${this.token?.id??''}`
  }

  asCoin (): ICoin {
    if (!this.token.isNative()) {
      throw new Error(`not a native token: ${this.toString()}`)
    }
    return { amount: this.amount, denom: this.denom }
  }

  asFee (gas: Uint128 = this.amount): IFee {
    if (!this.token.isNative()) {
      throw new Error(`not a native token: ${this.toString()}`)
    }
    return { amount: [this.asCoin()], gas }
  }
}

/** The chain's natively implemented token (such as SCRT on Secret Network). */
class NativeToken extends FungibleToken {
  constructor (readonly denom: string) { super() }
  /** The token's unique id. */
  get id () { return this.denom }
  /** @returns false */
  isCustom (): this is CustomToken { return false }
  /** @returns true */
  isNative (): this is NativeToken { return true }

  fee (amount: string|number|bigint): IFee {
    return new Fee(amount, this.id)
  }
}

/** A contract-based token. */
class CustomToken extends FungibleToken {
  constructor (readonly address: Address, readonly codeHash?: string) { super() }
  /** The token contract's address. */
  get id () { return this.address }
  /** @returns true */
  isCustom (): this is CustomToken { return true }
  /** @returns false */
  isNative (): this is NativeToken { return false }
}
