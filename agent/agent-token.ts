import type { Agent, Address, ClientClass, Uint128, ICoin } from './agent'
import { Coin, Client } from './agent-client'

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
  asClient <C extends ClientClass<Client>> (
    agent?: Agent, $C: C = Client as unknown as C
  ): InstanceType<C> {
    const options = { agent, address: this.addr, codeHash: this.hash }
    return new $C(options) as InstanceType<C>
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
