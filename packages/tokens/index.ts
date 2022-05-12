import type { Uint128, Address } from '@fadroma/client'

export type TokenType = CustomToken | NativeToken;

export class TokenPair {
  constructor(
    readonly token_0: TokenType,
    readonly token_1: TokenType
  ) { }
}

export class TokenPairAmount {
  constructor(
    readonly pair: TokenPair,
    readonly amount_0: Uint128,
    readonly amount_1: Uint128
  ) { }
}

export class TokenTypeAmount {
  constructor(
    readonly token: TokenType,
    readonly amount: Uint128
  ) { }
}

export interface CustomToken {
  custom_token: {
    contract_addr: Address;
    token_code_hash: string;
  };
}

export interface NativeToken {
  native_token: {
    denom: string;
  };
}

export enum TypeOfToken {
  Native,
  Custom
}

/** Extract some comparable id from the token type */
 export function get_type_of_token_id(token: TypeOfToken | TokenType): string {
  if ((token as unknown as NativeToken).native_token) {
    return "native";
  }

  const address = (token as unknown as CustomToken).custom_token?.contract_addr;

  if (!address) {
    throw new Error("TypeOfToken is not correct, missing address");
  }

  return address;
}

export function add_native_balance_pair(amount: TokenPairAmount): Coin[] | undefined {
  let result: Coin[] | undefined = []

  if (get_token_type(amount.pair.token_0) == TypeOfToken.Native) {
    result.push(create_coin(amount.amount_0))
  }
  else if (get_token_type(amount.pair.token_1) == TypeOfToken.Native) {
    result.push(create_coin(amount.amount_1))
  } else {
    result = undefined
  }

  return result
}

export function add_native_balance(amount: TokenTypeAmount): Coin[] | undefined {
  let result: Coin[] | undefined = []

  if (get_token_type(amount.token) == TypeOfToken.Native) {
    result.push(create_coin(amount.amount))
  }
  else {
    result = undefined
  }

  return result
}

export function get_token_type(token: TokenType): TypeOfToken {
  if (token.hasOwnProperty('native_token')) {
    return TypeOfToken.Native
  }
  return TypeOfToken.Custom
}

export * from './snip20'
