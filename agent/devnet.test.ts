import assert from 'node:assert'
import * as Stub from './stub'
import { Mode } from './chain'

export default async function testDevnet () {
  const devnet = {
    accounts: [],
    chainId: 'foo',
    platform: 'bar',
    running: false,
    stateDir: '/tmp/foo',
    url: new URL('http://example.com'),
    async start () { return this },
    async getAccount () { return {} },
    async assertPresence () {}
  }
  const chain = new Stub.Agent({
    mode:    Mode.Devnet,
    chainId: 'bar',
    url:     'http://asdf.com',
    devnet,
  })
  // Properties from Devnet are passed onto Chain
  assert.equal(chain.devnet, devnet)
  //assert.equal(chain.chainId, 'foo')
  assert.equal(chain.url, 'http://example.com/')
  assert.equal(chain.mode, Mode.Devnet)
  assert.equal(chain.stopped, true)
  devnet.running = true
  assert.equal(chain.stopped, false)
  assert.throws(()=>chain.devnet=devnet)
  assert.throws(()=>chain.stopped=true)
}
