import { packageRoot } from './package'
import { fixture } from '../fixtures/fixtures'
import type * as Devnets from './devnet'
import { Connection, Token } from '@hackbg/fadroma'
import { OCIContainer, OCIImage } from '@fadroma/oci'
import { ok, equal, deepEqual, throws, rejects } from 'node:assert'
import { getuid, getgid } from 'node:process'
import { resolve } from 'node:path'

export async function testDevnetPlatform <
  A extends typeof Connection, D extends typeof Devnets.Container,
> (
  Connection: A,
  Devnet:     D,
  version:    string,
  daemon:     string,
  gasToken:   Token.Native
) {
  const codePath = resolve(packageRoot, 'fixtures', 'fadroma-example-cw-null@HEAD.wasm')
  let devnet: InstanceType<D> = new (Devnet as any)({
    gasToken,
    genesisAccounts: { User1: 12345678, User2: 87654321, },
    genesisUploads: {
      '7': { codePath: fixture('fadroma-example-cw-null@HEAD.wasm') },
      '8': { codePath: fixture('fadroma-example-cw-echo@HEAD.wasm') },
    }
  })
  ok(devnet, "construct devnet")
  ok(typeof devnet.chainId === 'string')
  ok(devnet.gasToken)
  ok(devnet.gasToken instanceof Token.Fungible)
  ok(typeof devnet.gasToken.denom === 'string')
  equal(devnet.initScriptMount, '/devnet.init.mjs')
  ok((await devnet.image) instanceof OCIImage)
  deepEqual(devnet.spawnEnv.DAEMON,    daemon)
  deepEqual(devnet.spawnEnv.TOKEN,     gasToken.denom)
  deepEqual(devnet.spawnEnv.CHAIN_ID,  devnet.chainId)
  deepEqual(devnet.spawnEnv.ACCOUNTS,  JSON.stringify(devnet.genesisAccounts))
  deepEqual(devnet.spawnEnv.STATE_UID, String(getuid!()))
  deepEqual(devnet.spawnEnv.STATE_GID, String(getgid!()))
  if (devnet.portMode === 'http') {
    deepEqual(devnet.spawnEnv.HTTP_PORT, String(devnet.port))
  } else {
    deepEqual(devnet.spawnEnv.RPC_PORT, String(devnet.port))
  }
  deepEqual(devnet.spawnOptions.env, devnet.spawnEnv)
  deepEqual(devnet.spawnOptions.exposed, [ `${String(devnet.port)}/tcp` ])
  deepEqual(devnet.spawnOptions.extra.HostConfig.PortBindings, {
    [`${String(devnet.port)}/tcp`]: [ { HostPort: String(devnet.port) } ]
  }, "devnet port binding is present")
  equal(await devnet.container, undefined)
  ok(await devnet.create())
  equal(devnet.url.toString(), `http://${devnet.host}:${devnet.port}/`)
  ok((await devnet.container) instanceof OCIContainer)
  equal((await devnet.container)!.name, `/${devnet.chainId}`)
  ok(await devnet.start())
  const agent = await devnet.connect({ name: 'User1' })
  ok(agent instanceof Connection)
  equal(agent.chainId, devnet.chainId)
  equal(agent.url, devnet.url)
  ok(await devnet.pause())
  ok(await devnet.export())
  ok(await devnet.delete())
}
