import connect, { ConnectConfig, ConnectError, ConnectConsole } from './connect'
import * as assert from 'node:assert'

import { TestSuite } from '@hackbg/ensuite'
export default new TestSuite(import.meta.url, [
  ['chains',  testConnectChains],
  ['config',  testConnectConfig],
  ['errors',  testConnectErrors],
  ['console', testConnectConsole],
])

export async function testConnectChains () {
  for (const platform of ['secretjs', 'secretcli']) {
    for (const mode of ['mainnet', 'testnet', 'devnet', 'mocknet']) {
      const agent = connect({ platform, mode, mnemonic: '...' })
    }
  }
}

export async function testConnectConfig () {
  const config = new ConnectConfig()
  config.getChain()
  config.getChain(null as any)
  assert.throws(()=>config.getChain('NoSuchChain' as any))
  config.getAgent()
  config.listChains()
}

export async function testConnectErrors () {
  new ConnectError.NoChainSelected()
  new ConnectError.UnknownChainSelected('', {})
}

export async function testConnectConsole () {
  new ConnectConsole('testing console').selectedChain()
}
