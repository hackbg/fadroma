/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Console, Error, assign, into, intoArray, intoRecord } from './core'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['collections', testCollections],
  ['assign',      testAssign],
])

export async function testCollections () {
  assert.equal(await into(1), 1)

  assert.equal(await into(Promise.resolve(1)), 1)

  assert.equal(await into(()=>1), 1)

  assert.equal(await into(async ()=>1), 1)

  assert.deepEqual(
    await intoArray([1, ()=>1, Promise.resolve(1), async () => 1]),
    [1, 1, 1, 1]
  )

  assert.deepEqual(await intoRecord({
    ready:   1,
    getter:  () => 2,
    promise: Promise.resolve(3),
    asyncFn: async () => 4
  }), {
    ready:   1,
    getter:  2,
    promise: 3,
    asyncFn: 4
  })
}

export async function testAssign () {
  assert.throws(()=>assign({}, {}, '' as any))
  assert.ok(()=>assign({}, {}, []))
}
