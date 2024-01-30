import { packageRoot } from './package'
import type * as Devnets from './devnet'
import DevnetContainer from './devnet-base'
import { Core, Chain, Token } from '@fadroma/agent'
import * as OCI from '@fadroma/oci'
import { ok, equal, deepEqual, throws, rejects } from 'node:assert'
import { getuid, getgid } from 'node:process'
import { resolve } from 'node:path'
import * as Impl from './devnet-impl'
import { fixture } from '@fadroma/fixtures'
import * as Platform from './devnet-platform'

export async function testDevnetPlatform (
  name: keyof typeof Platform, version: string,
) {
  const spec = Platform[name].version(version as never, 'no-version', 'no-checksum')
  const codePath = resolve(
    packageRoot, 'fixtures', 'fadroma-example-cw-null@HEAD.wasm'
  )
  const user1 = Core.randomBech32(spec.bech32Prefix)
  const user2 = Core.randomBech32(spec.bech32Prefix)
  let devnet = new DevnetContainer({
    ...spec,
    onScriptExit: 'remove',
    genesisAccounts: {
      [user1]: 12345678,
      [user2]: 87654321,
    },
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
  ok((await devnet.container.image) instanceof OCI.Image)
  const spawnEnv = Impl.containerEnvironment(devnet)
  deepEqual(spawnEnv.DAEMON,    spec.nodeBinary)
  deepEqual(spawnEnv.TOKEN,     spec.gasToken.denom)
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
  equal(await devnet.created, devnet)
  equal(devnet.url.toString(), `http://${devnet.nodeHost}:${devnet.nodePort}/`)
  ok(devnet.container instanceof OCI.Container)
  equal(devnet.container.name, devnet.chainId)
  equal(await devnet.started, devnet)
  const agent = await devnet.connect({ name: user1 })

  // wait for internal SigningCosmWasmClient.connectWithSigner fetch
  // to complete - otherwise the test is flaky
  await new Promise(resolve=>setTimeout(resolve, 1000))

  ok(agent instanceof spec.Connection)
  equal(agent.chainId, devnet.chainId)
  equal(agent.url, devnet.url)
  // process.exit(123) // uncomment for testing exit handler
  equal(await devnet.paused, devnet)
  const exported = await devnet.export()
  await devnet.container.engine.image(exported).remove()
  equal(await devnet.removed, devnet)
}
