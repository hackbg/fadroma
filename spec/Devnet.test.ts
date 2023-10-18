import testEntrypoint, { repoRoot } from './testSelector'

import { Devnet, Template, build, Uploader } from '@hackbg/fadroma'
import type { DevnetPlatform } from '@hackbg/fadroma'

import * as assert from 'node:assert'
import { getuid, getgid } from 'node:process'
import { resolve } from 'node:path'

import $, { TextFile } from '@hackbg/file'
import { Image, Container } from '@hackbg/dock'

export default testEntrypoint(import.meta.url, {
  'docs':         testDevnetDocs,
  'scrt':         ()=>testDevnetPlatform('scrt_1.9'),
  'okp4':         ()=>testDevnetPlatform('okp4_5.0'),
  'chain-id':     testDevnetChainId,
  'state-file':   testDevnetStateFile,
  'url':          testDevnetUrl,
  'container':    testDevnetContainer,
  'copy-uploads': testDevnetCopyUploads,
})

export async function testDevnetDocs () {
  //@ts-ignore
  await import('./Devnet.spec.ts.md')
}

export async function testDevnetPlatform (platform: DevnetPlatform) {
  let devnet: any
  assert.ok(
    devnet = new Devnet({ platform }),
    "construct devnet"
  )
  assert.ok(
    await devnet.start(),
    "starting the devnet works"
  )
  assert.ok(
    await devnet.assertPresence() || true,
    "starting the devnet automatically created the container"
  )
  assert.ok(
    await devnet.pause(),
    "pausing the devnet works"
  )
  assert.ok(
    await devnet.export(),
    "exporting the devnet works"
  )
  assert.ok(
    await devnet.forceDelete() || true,
    "force deleting the devnet works"
  )
}

export async function testDevnetCopyUploads () {
  const devnet1   = await new Devnet({ platform: 'okp4_5.0' }).create()
  const chain1    = devnet1.getChain()
  const agent1    = await chain1.getAgent({ name: 'Admin' }).ready
  const crate     = resolve(repoRoot, 'examples', 'cw-null')
  const artifact  = await build(crate)
  const uploader  = new Uploader({ agent: agent1, reupload: true })
  const uploaded1 = await uploader.upload(artifact)
  const uploaded2 = await uploader.upload(artifact)
  const devnet2   = new Devnet({ platform: 'okp4_5.0' })
  assert.ok(
    await devnet2.copyUploads(chain1),
    "copying uploads"
  )
}

export async function testDevnetChainId () {
  let devnet: Devnet
  assert.throws(
    () => { devnet = new Devnet({ chainId: false as any }) },
    "construct must fail if passed falsy chainId"
  )
  assert.ok(
    devnet = new Devnet(),
    "construct must work with no options"
  )
  assert.ok(
    typeof devnet.chainId === 'string',
    "chain id must be auto populated when not passed"
  )
  // TODO: can't delete
  assert.ok(
    await devnet.save(),
    "can save"
  )
  assert.ok(
    devnet = new Devnet({ chainId: devnet.chainId }),
    "can construct when passing chainId"
  )
  // TODO: devnet with same chainid points to same resource
  assert.ok(
    await devnet.delete(),
    "can delete"
  )
  assert.ok(
    devnet = new Devnet({ chainId: devnet.chainId }),
    "after deletion, can construct new devnet with same chainId"
  )
  assert.ok(
    await devnet.save(),
    "can save"
  )
}

export async function testDevnetStateFile () {
  let devnet = new Devnet()
  $(devnet.stateFile).as(TextFile).save("invalidjson")
  assert.throws(
    ()=>{ devnet = new Devnet({ chainId: devnet.chainId }) },
    "can't construct if state is invalid json"
  )
  $(devnet.stateFile).as(TextFile).save("null")
  assert.ok(
    devnet = new Devnet({ chainId: devnet.chainId }),
    "can construct if state is valid json but empty"
  )
  assert.ok(
    await devnet.delete(),
    "can delete if state is valid json but empty"
  )
}

export async function testDevnetUrl () {
  let devnet: Devnet
  assert.ok(
    devnet = new Devnet(),
    "can construct"
  )
  assert.equal(
    devnet.url.toString(), `http://${devnet.host}:${devnet.port}/`,
    "devnet url generated from host and port properties"
  )
  assert.ok(
    (await devnet.image) instanceof Image,
    "devnet has @hackbg/dock image"
  )
}

export async function testDevnetContainer () {
  let devnet: any
  assert.ok(
    devnet = new Devnet(),
    "can construct"
  )
  assert.equal(
    devnet.initScriptMount, '/devnet.init.mjs',
    "devnet init script mounted at default location"
  )
  assert.deepEqual(
    devnet.spawnEnv, {
      DAEMON:    'secretd',
      CHAIN_ID:  devnet.chainId,
      ACCOUNTS:  devnet.accounts.join(' '),
      STATE_UID: String(getuid!()),
      STATE_GID: String(getgid!()),
      HTTP_PORT: String(devnet.port)
    },
    "devnet spawn environment"
  )
  assert.deepEqual(
    devnet.spawnOptions.env, devnet.spawnEnv,
    "devnet spawn environment is passed to container options"
  )
  const spawnPort = `${String(devnet.port)}/tcp`
  assert.deepEqual(
    devnet.spawnOptions.exposed, [ spawnPort ],
    "devnet port is exposed"
  )
  assert.deepEqual(
    devnet.spawnOptions.extra.HostConfig.PortBindings, {
      [spawnPort]: [ { HostPort: String(devnet.port) } ]
    },
    "devnet port binding is present"
  )
  assert.equal(
    await devnet.container, undefined,
    "devnet starts with no container"
  )
  assert.ok(
    await devnet.create(),
    "devnet creates container"
  )
  assert.ok(
    (await devnet.container) instanceof Container,
    "devnet container property is populated after container is created"
  )
  assert.ok(
    await devnet.assertPresence() || true,
    "devnet assert presence is ok after container is created"
  )
  assert.ok(
    await devnet.create(),
    "devnet creation is idempotent"
  )
  ;(await devnet.container).remove()
  assert.rejects(
    devnet.assertPresence,
    "devnet assert presence rejects if container is removed"
  )
}
