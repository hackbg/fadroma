import assert, { equal, throws, rejects } from 'node:assert'
import { Error } from './base'
import * as Stub from './stub'
import { Mode } from './chain'
import { Agent } from './chain'
import { Devnet } from './devnet'

class MyDevnet extends Devnet<typeof Stub.Agent> {
  Agent = Stub.Agent
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
  const agent = await devnet.connect({ name: 'Alice' })
  //equal(chain.chainId, 'foo')
  equal(agent.url, 'http://example.com/')
  equal(agent.mode, Mode.Devnet)
  equal(agent.stopped, true)
  devnet.running = true
  equal(agent.stopped, false)
  throws(()=>agent.stopped=true)
  agent.chainId
  agent.url
  agent.mode
  agent.devnet
  agent.stopped
  throws(()=>agent.chainId = "")
  throws(()=>agent.url = "")
}
