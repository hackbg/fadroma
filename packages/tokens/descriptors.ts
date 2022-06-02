import { Uint128, Address, ICoin, Coin } from '@fadroma/client'

/** There are two kinds of token supported:
  * - the chain's native token, in a specific denomination
  * - contract-based custom tokens. */
export enum TokenKind {
  Native = "TokenKind.Native",
  Custom = "TokenKind.Custom"
}

/** Return the kind of a token specified in the passed token descriptor. */
export function getTokenKind (token: Token): TokenKind {
  return (token.hasOwnProperty('native_token')) ? TokenKind.Native : TokenKind.Custom
}

/** Extract some comparable id from the token type:
  * - the string "native" if it's the chain's native token
  * - the address of the token, if it's a custom token */
export function getTokenId (token: Token): string {
  if ((token as NativeToken).native_token) {
    return "native";
  }
  const address = (token as CustomToken).custom_token?.contract_addr;
  if (!address) {
    throw new Error("Token descriptor is not correct, missing address");
  }
  return address;
}

/** Token descriptor. Specifies:
  * - kind of token (native or custom)
  * - identity of token (denomination or addr/hash) */
export type Token = NativeToken | CustomToken;

export interface CustomToken {
  custom_token: {
    contract_addr:    Address
    token_code_hash?: string
  }
}

export interface NativeToken {
  native_token: {
    denom: string
  }
}

/** An amount of a token. */
export class TokenAmount {
  constructor (
    readonly token:  Token,
    readonly amount: Uint128
  ) {}
  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance (): ICoin[]|undefined {
    let result: ICoin[] | undefined = []
    if (getTokenKind(this.token) == TokenKind.Native) {
      result.push(new Coin(this.amount, (this.token as NativeToken).native_token.denom))
    } else {
      result = undefined
    }
    return result
  }
}

/** A pair of two token descriptors. */
export class TokenPair {
  constructor (readonly token_0: Token, readonly token_1: Token) {}
  get reverse () {
    return new TokenPair(this.token_1, this.token_0)
  }
  static fromName (knownTokens: Record<string, Token>, name: string) {
    const [token_0_symbol, token_1_symbol] = name.split('-')
    const token_0 = knownTokens[token_0_symbol]
    const token_1 = knownTokens[token_1_symbol]
    if (!token_0) {
      throw Object.assign(
        new Error(`TokenPair#fromName: unknown token ${token_0_symbol}`),
        { symbol: token_0_symbol }
      )
    }
    if (!token_1) {
      throw Object.assign(
        new Error(`TokenPair#fromName: unknown token ${token_1_symbol}`),
        { symbol: token_1_symbol }
      )
    }
    return new TokenPair(token_0, token_1)
  }
}

/** A pair of two token descriptors, and amounts of each token. */
export class TokenPairAmount {
  constructor (
    readonly pair:     TokenPair,
    readonly amount_0: Uint128,
    readonly amount_1: Uint128
  ) {}
  get reverse () {
    return new TokenPairAmount(this.pair.reverse, this.amount_1, this.amount_0)
  }
  /** Pass this to 'send' field of ExecOpts */
  get asNativeBalance () {
    let result: ICoin[] | undefined = []
    if (getTokenKind(this.pair.token_0) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_0 as NativeToken
      result.push(new Coin(this.amount_0, denom))
    } else if (getTokenKind(this.pair.token_1) == TokenKind.Native) {
      const {native_token:{denom}} = this.pair.token_1 as NativeToken
      result.push(new Coin(this.amount_1, denom))
    } else {
      result = undefined
    }
    return result
  }
}
