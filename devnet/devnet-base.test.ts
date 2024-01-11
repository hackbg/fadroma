import { packageRoot } from './package'
import type * as Devnets from './devnet'
import { Connection, Token } from '@hackbg/fadroma'
import { OCIContainer, OCIImage } from '@fadroma/oci'
import { ok, equal, deepEqual, throws, rejects } from 'node:assert'
import { getuid, getgid } from 'node:process'
import { resolve } from 'node:path'
import * as Impl from './devnet-impl'

//@ts-ignore
import { fixture } from '../fixtures/fixtures'

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
  ok((await devnet.container.image) instanceof OCIImage)

  const spawnEnv = Impl.containerEnvironment(devnet)
  deepEqual(spawnEnv.DAEMON,    daemon)
  deepEqual(spawnEnv.TOKEN,     gasToken.denom)
  deepEqual(spawnEnv.CHAIN_ID,  devnet.chainId)
  deepEqual(spawnEnv.ACCOUNTS,  JSON.stringify(devnet.genesisAccounts))
  deepEqual(spawnEnv.STATE_UID, String(getuid!()))
  deepEqual(spawnEnv.STATE_GID, String(getgid!()))
  if (devnet.nodePortMode === 'http') {
    deepEqual(spawnEnv.HTTP_PORT, String(devnet.nodePort))
  } else {
    deepEqual(spawnEnv.RPC_PORT, String(devnet.nodePort))
  }

  const spawnOptions = Impl.containerOptions(devnet)
  deepEqual(spawnOptions.env, spawnEnv)
  deepEqual(spawnOptions.exposed, [ `${String(devnet.nodePort)}/tcp` ])
  deepEqual(spawnOptions.extra.HostConfig.PortBindings, {
    [`${String(devnet.nodePort)}/tcp`]: [ { HostPort: String(devnet.nodePort) } ]
  }, "devnet port binding is present")
  equal(await devnet.container, undefined)

  ok(await devnet.created)
  equal(devnet.url.toString(), `http://${devnet.nodeHost}:${devnet.nodePort}/`)
  ok((await devnet.container) instanceof OCIContainer)
  equal((await devnet.container)!.name, `/${devnet.chainId}`)

  ok(await devnet.started)
  const agent = await devnet.connect({ name: 'User1' })
  ok(agent instanceof Connection)
  equal(agent.chainId, devnet.chainId)
  equal(agent.url, devnet.url)

  ok(await devnet.paused)
  ok(await devnet.export())

  ok(await devnet.deleted)

}
