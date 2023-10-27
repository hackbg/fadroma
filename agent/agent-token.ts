/**

  Fadroma: Base Token Support
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import { Coin } from './agent-base'
import type { Agent, Address, ContractClientClass, Uint128, ICoin } from './agent'
import { ContractClient } from './agent-contract'

/** An identifiable token on a network. */
export abstract class Token {
  /** The token's unique id. */
  abstract get id (): string
  /** Whether this token is fungible. */
  abstract isFungible (): this is TokenFungible
}

/** An abstract non-fungible token. */
export abstract class TokenNonFungible extends Token {
  /** @returns false */
  isFungible = () => false
}

/** An abstract fungible token. */
export abstract class TokenFungible extends Token {
  /** @returns true */
  isFungible = () => true
  /** Whether this token is natively supported by the chain. */
  abstract isNative (): this is NativeToken
  /** Whether this token is implemented by a smart contract. */
  abstract isCustom (): this is CustomToken
}

/** The chain's natively implemented token (such as SCRT on Secret Network). */
export class NativeToken extends TokenFungible {
  constructor (readonly denom: string) { super() }
  /** The token's unique id. */
  get id () { return this.denom }
  /** @returns false */
  isCustom = () => false
  /** @returns true */
  isNative = () => true
}

/** A contract-based token. */
export class CustomToken extends TokenFungible {
  constructor (readonly addr: Address, readonly hash?: string) { super() }
  /** The token contract's address. */
  get id () { return this.addr }
  /** @returns true */
  isCustom = () => true
  /** @returns false */
  isNative = () => false
  /** @returns Client */
  asClient <C extends ContractClientClass<ContractClient>> (
    agent: Agent, $C: C = ContractClient as unknown as C
  ): InstanceType<C> {
    const options = { address: this.addr, codeHash: this.hash }
    return new $C(agent, options) as InstanceType<C>
  }
}

/** A pair of tokens. */
export class Pair {
  constructor (readonly a: Token, readonly b: Token) {}
  get reverse (): Pair { return new Pair(this.b, this.a) }
}

/** An amount of a fungible token. */
export class Amount {
  constructor (public token: TokenFungible, public amount: Uint128) {}
  /** Pass this to 'send' field of ExecOpts. */
  get asNativeBalance (): ICoin[] {
    if (this.token.isNative()) return [new Coin(this.amount, this.token.denom)]
    return []
  }
}

/** A pair of token amounts. */
export class Swap {
  constructor (readonly a: Amount, readonly b: Amount) {}
  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance (): ICoin[] {
    let result: ICoin[] = []
    if (this.a.token.isNative()) result = [...result, ...this.a.asNativeBalance]
    if (this.b.token.isNative()) result = [...result, ...this.b.asNativeBalance]
    return result
  }
}
