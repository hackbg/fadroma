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
  equal(agent.chainUrl, 'http://example.com/')
  equal(agent.chainMode, Mode.Devnet)
  //equal(agent.chainStopped, true)
  devnet.running = true
  //equal(agent.chainStopped, false)
  //throws(()=>agent.chainStopped=true)
  equal(agent.chainId, devnet.chainId)
  equal(agent.chainUrl, devnet.url)
  equal(agent.chainMode, 'devnet')
  equal(agent.devnet, devnet)
  throws(()=>agent.chainId = "")
  throws(()=>agent.chainUrl = "")
}
