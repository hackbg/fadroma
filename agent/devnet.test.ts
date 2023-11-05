import assert, { equal, throws, rejects } from 'node:assert'
import { Error } from './base'
import * as Stub from './stub'
import { Mode } from './chain'
import type { Agent } from './chain'
import { Devnet, assignDevnet } from './devnet'

class MyDevnet extends Devnet {
  accounts = []
  chainId = 'foo'
  platform = 'bar'
  running = false
  stateDir = '/tmp/foo'
  url = new URL('http://example.com')

  async start (): Promise<this> {
    this.running = true
    return this
  }

  async pause (): Promise<this> {
    this.running = false
    return this
  }

  async import (...args: unknown[]): Promise<unknown> {
    throw new Error("unimplemented")
  }

  async export (...args: unknown[]) {
    throw new Error("unimplemented")
  }

  async mirror (...args: unknown[]) {
    throw new Error("unimplemented")
  }

  async getGenesisAccount (name: string): Promise<Partial<Agent>> {
    return { name }
  }
}

export default async function testDevnet () {
  const devnet = new MyDevnet()
  const chain = new Stub.Agent({ mode: Mode.Devnet, chainId: 'bar', url: 'http://asdf.com', devnet })
  // Properties from Devnet are passed onto Chain
  equal(chain.devnet, devnet)
  //equal(chain.chainId, 'foo')
  equal(chain.url, 'http://example.com/')
  equal(chain.mode, Mode.Devnet)
  equal(chain.stopped, true)
  devnet.running = true
  equal(chain.stopped, false)
  throws(()=>chain.devnet=devnet)
  throws(()=>chain.stopped=true)
  await chain.authenticate({ name: 'Alice' })
  const chain2 = new Stub.Agent({ mode: Mode.Mainnet, devnet })
  const agent: any = {}
  assignDevnet(agent as any, devnet)
  agent.chainId
  agent.url
  agent.mode
  agent.devnet
  agent.stopped
  throws(()=>agent.chainId = "")
  throws(()=>agent.url = "")
  throws(()=>agent.mode = "")
  throws(()=>agent.devnet = "")
  throws(()=>agent.stopped = "")
}
