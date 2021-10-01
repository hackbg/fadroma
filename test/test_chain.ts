import { test } from 'tap'
import { Scrt } from '@fadroma/scrt'
import { MockDocker } from './mocks'

for (const chain of ['localnet_1_0', 'localnet_1_2']) {
  test(`${chain} can pass names of accounts to create on localnet spawn`, async ({ok, same})=>{
    const identities = ["FOO", "BAR", "BAZ"]
    const chain = Scrt.localnet_1_0({ identities })
    same(chain.node.identitiesToCreate, identities)
    chain.node.docker = new MockDocker()
    await chain.ready
  })
}
