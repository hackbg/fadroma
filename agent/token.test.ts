import assert from 'node:assert'
import { addZeros, Token, Fungible, NonFungible, Coin, Fee, Pair, Amount, Swap } from './token'

class MyFungible extends Fungible {
  get id () {
    return 'mytoken'
  }
  isNative () {
    return true
  }
  isCustom () {
    return false
  }
}

class MyNonFungible extends NonFungible {
  get id () {
    return 'mynft'
  }
  isNative () {
    return true
  }
  isCustom () {
    return false
  }
}

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['fungible',    testFungible],
  ['nonfungible', testNonFungible],
  ['decimals',    testDecimals],
  ['coins',       testCoins],
  ['fees',        testFees],
  ['swap',        testSwaps],
])

export async function testDecimals () {
  assert.equal(addZeros('1', 18), '1000000000000000000')
}

export async function testCoins () {
  new Coin(1000, 'utest')
  new Coin('1000', 'utest')
}

export async function testFees () {
  // FIXME: new Fee(gas, amounts[])
  new Fee(1000, 'utest', '100000')
}

export async function testFungible () {
  assert(new MyFungible().isFungible())
}

export async function testNonFungible () {
  assert(!(new MyNonFungible().isFungible()))
}

export async function testSwaps () {
  assert(new Pair(
    new MyFungible(),
    new MyNonFungible()
  ).reverse instanceof Pair)

  assert(new Amount(
    new MyFungible(),
    '1000000000000'
  ).asNativeBalance instanceof Array)

  assert(new Swap(
    new Amount(new MyFungible(), '1000000000000'),
    new Amount(new MyFungible(), '1000000000000'),
  ).asNativeBalance instanceof Array)
}
