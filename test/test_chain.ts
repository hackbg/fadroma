import { test } from 'tap'
import { Scrt } from '@fadroma/scrt'
import { MockDocker } from './mocks'

for (const chain of ['devnet_1_0', 'devnet_1_2']) {
  test(`${chain} can pass names of accounts to create on devnet spawn`, async ({ok, same})=>{
    const identities = ["ADMIN", "FOO", "BAR", "BAZ"]
    const chain = Scrt.devnet_1_0({ identities })
    same(chain.node.identitiesToCreate, identities)
    chain.node.docker = new MockDocker()
    chain.defaultIdentity = null
    await chain.ready
    ok(await chain.getAgent('ADMIN'))
    ok(await chain.getAgent('FOO'))
  })
}
