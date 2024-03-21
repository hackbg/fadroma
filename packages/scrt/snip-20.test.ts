import assert from 'node:assert'
import { Snip20, ViewingKeyClient } from './snip-20'

export default function testSnip20 () {
  assert(Snip20.init({
    name: 'My Token',
    symbol: 'TOKEN',
    decimals: 12,
    admin: 'address'
  }).prng_seed?.length > 0)

  assert.equal(new Snip20('address').id, 'address')

  assert(new Snip20('address').vk instanceof ViewingKeyClient)
}
