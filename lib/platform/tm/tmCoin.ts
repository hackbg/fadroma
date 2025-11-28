
/** Convert to coin. */
export const makeCoin = (amount: Uint128, denom: string): Coin => ({ amount: String(amount), denom })

/** Convert to fee. */
export const makeFee = (gas: Uint128, amount: Coin[]): Fee => ({ gas: String(gas), amount })

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

//const writeVarint32 = (val: number, buf: Uint8Array, pos: number) => {
    //while (val > 127) {
        //buf[pos++] = val & 127 | 128;
        //val >>>= 7;
    //}
    //buf[pos] = val;
//}

