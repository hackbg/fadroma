/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Token, Fungible, NonFungible, Native, Custom, Coin, Fee, Pair, Amount, Swap } from './token'

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
  assert.equal(Fungible.addZeros('1', 18), '1000000000000000000')
}

export async function testCoins () {
  new Coin(1000, 'utest')
  new Coin('1000', 'utest')
}

export async function testFees () {
  // FIXME: new Fee(gas, amounts[])
  new Fee(1000, 'utest', '100000')[Symbol.toStringTag]
}

export async function testFungible () {
  assert(new MyFungible().isFungible())

  assert(new Native('foo').isFungible())
  assert(new Native('foo').id === 'foo')
  assert(new Native('foo').isNative())
  assert(!(new Native('foo').isCustom()))

  assert(new Custom('foo').isFungible())
  assert(new Custom('foo').id === 'foo')
  assert(!(new Custom('foo').isNative()))
  assert(new Custom('foo').isCustom())
}

export async function testNonFungible () {
  assert(!(new MyNonFungible().isFungible()))
}

export async function testSwaps () {

  const MYFT = new MyFungible()
  const MYNFT = new MyNonFungible()
  const MYFT_MYNFT = new Pair(MYFT, MYNFT)
  assert(MYFT_MYNFT.reverse instanceof Pair)
  assert(MYFT_MYNFT.reverse.a === MYNFT)
  assert(MYFT_MYNFT.reverse.b === MYFT)

  const amount = new Amount('1000000000000', MYFT)
  assert(amount.asNativeBalance instanceof Array)
  assert(new Amount('1000000000000', new Custom('MYCFT')).asNativeBalance instanceof Array)

  const swap = new Swap(
    new Amount('1000000000000', MYFT),
    new Amount('1000000000000', MYFT),
  )
  assert(swap.reverse instanceof Swap)
}
