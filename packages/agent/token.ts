/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address } from './chain'

/** A 128-bit integer. */
export type Uint128 = string

/** A 256-bit integer. */
export type Uint256 = string

/** A 128-bit decimal fraction. */
export type Decimal128 = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

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
      return this.amount.map(({ amount, denom })=>{
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

/** An identifiable token on a network. */
abstract class Token {
  /** The token's unique id. */
  abstract get id (): string
  /** Whether this token is fungible. */
  abstract isFungible (): this is FungibleToken
}

/** An abstract non-fungible token. */
abstract class NonFungibleToken extends Token {
  /** @returns false */
  isFungible = () => false
}

/** An abstract fungible token. */
abstract class FungibleToken extends Token {
  /** @returns true */
  isFungible = () => true
  /** Whether this token is natively supported by the chain. */
  abstract isNative (): this is NativeToken
  /** Whether this token is implemented by a smart contract. */
  abstract isCustom (): this is CustomToken

  static readonly addZeros = (n: number|Uint128, z: number): Uint128 => {
    return `${n}${[...Array(z)].map(() => '0').join('')}`
  }

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
  isCustom = () => false
  /** @returns true */
  isNative = () => true

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
  isCustom = () => true
  /** @returns false */
  isNative = () => false
}

/** A pair of tokens. */
class TokenPair {
  constructor (readonly a: Token, readonly b: Token) {}
  /** Reverse the pair. */
  get reverse (): TokenPair {
    return new TokenPair(this.b, this.a)
  }
}

/** A pair of token amounts. */
class TokenSwap {
  constructor (
    readonly a: TokenAmount|NonFungibleToken,
    readonly b: TokenAmount|NonFungibleToken
  ) {}
  /** Reverse the pair. */
  get reverse (): TokenSwap {
    return new TokenSwap(this.b, this.a)
  }
}

export {
  Token,
  FungibleToken    as Fungible,
  NonFungibleToken as NonFungible,
  NativeToken      as Native,
  CustomToken      as Custom,
  TokenPair        as Pair,
  TokenAmount      as Amount,
  TokenSwap        as Swap,
}
