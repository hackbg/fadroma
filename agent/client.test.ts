import assert from 'node:assert'
import { Chain } from './chain'
import { StubChain, StubAgent } from './stub'
import { ContractClient } from './client'
import { ContractInstance } from './deploy'

export async function testClient () {
  const chain = new StubChain({ id: 'foo', mode: Chain.Mode.Testnet })
  const agent = new StubAgent({ chain })
  const client = new ContractClient({
    address:  'addr',
    codeHash: 'code-hash-stub',
    codeId:   '100'
  }, agent)
  assert.equal(client.agent, agent)
  assert.equal(client.chain, chain)
  await client.query({foo: 'bar'})
  await client.execute({foo: 'bar'})

  assert(new ContractClient('addr'))
  assert(new ContractClient(new ContractInstance({ address: 'addr' })))
  assert.throws(()=>new ContractClient({}).query({}))
  assert.throws(()=>new ContractClient({}, agent).query({}))
  assert.throws(()=>new ContractClient({}).execute({}))
  assert.throws(()=>new ContractClient({}, agent).execute({}))
}

