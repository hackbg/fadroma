import { test, todo } from 'tap'

import { ScrtAgentJS_1_0 } from '@fadroma/scrt-1.0'
import { ScrtAgentJS_1_2 } from '@fadroma/scrt-1.2'
import { MockChain } from './mocks'

;(async()=>{
  for (const Agent of [ ScrtAgentJS_1_0, ScrtAgentJS_1_2 ]) {
    await validateImplementation(Agent)
  }
})()

async function validateImplementation (Agent: any) {

  test(`create ${Agent.name} from mnemonic`, async ({match}) => {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const chain = await new MockChain().ready
    const agent = await Agent.create({ chain, mnemonic })
    match(agent.mnemonic, mnemonic)
    match(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    match(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv' })
    chain.close() })

  todo(`create ${Agent.name} from keypair`, async () => {})

  todo(`create ${Agent.name} from signing pen`, async () => {})

  todo(`${Agent.name} has name`, async () => {})

  test(`${Agent.name} reads chain state and can wait for next block`, async ({ match }) => {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const chain = await new MockChain().ready
    const agent = await Agent.create({ chain, mnemonic })
    const [ {header:{height:block1}}, account1, balance1 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    await agent.nextBlock
    const [ {header:{height:block2}}, account2, balance2 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    match(block1 + 1, block2)
    match(account1, account2)
    match(balance1, balance2)
    chain.close() })

  todo(`${Agent.name} reads own balance`, async () => {})

  todo(`${Agent.name} sends native token`, async () => {})

  todo(`${Agent.name} sends native token to many recipients`, async () => {})

  todo(`${Agent.name} uploads, instantiates, queries, and transacts with contract`, async () => {})

}
