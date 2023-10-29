import assert from 'node:assert'
import { addZeros, Token, TokenFungible, TokenNonFungible, Coin, Fee } from './token'

export async function testDecimals () {
  assert.equal(addZeros('1', 18), '1000000000000000000')
}

export async function testToken () {

  new (class extends Token {
    get id () { return 'token' }
    isFungible () { return true }
  })()

  new (class extends TokenFungible {
    get id () { return 'token' }
    isNative () { return true }
    isCustom () { return false }
  })()

  new (class extends TokenNonFungible {
    get id () { return 'token' }
    isNative () { return true }
    isCustom () { return false }
  })()

  new Coin(1000, 'utest')
  new Coin('1000', 'utest')

  // FIXME: new Fee(gas, amounts[])
  new Fee(1000, 'utest', '100000')

}
