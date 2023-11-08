/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Uint128 } from './base'
import type { Agent } from './chain'
import { ContractClient } from './client'

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  amount: ICoin[] = []
  constructor (
    amount: Uint128|number, denom: string, public gas: string = String(amount)
  ) {
    this.add(amount, denom)
  }
  add = (amount: Uint128|number, denom: string) =>
    this.amount.push({ amount: String(amount), denom })

  get [Symbol.toStringTag] () {
    return `${this.gas}`
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

  connect (agent?: Agent): ContractClient 
  connect <C extends typeof ContractClient> (agent?: Agent, $C?: C): InstanceType<C> 
  connect <C extends typeof ContractClient> (
    agent?: Agent, $C: C = ContractClient as C
  ): InstanceType<C> {
    return new $C({ address: this.address, codeHash: this.codeHash }, agent) as InstanceType<C>
  }
}

/** A pair of tokens. */
class TokenPair {
  constructor (readonly a: Token, readonly b: Token) {}
  /** Reverse the pair. */
  get reverse (): TokenPair {
    return new TokenPair(this.b, this.a)
  }
}

/** An amount of a fungible token. */
class TokenAmount {
  constructor (public amount: Uint128, public token: FungibleToken,) {}
  /** Pass this to send, initSend, execSend */
  get asNativeBalance (): ICoin[] {
    if (this.token.isNative()) {
      return [new Coin(this.amount, this.token.denom)]
    }
    return []
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
