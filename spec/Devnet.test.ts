import { Devnet } from '@hackbg/fadroma'
import * as assert from 'node:assert'
import { getuid, getgid } from 'node:process'
import $, { TextFile } from '@hackbg/file'
import { Image, Container } from '@hackbg/dock'

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const initScript = resolve(dirname(fileURLToPath(import.meta.url)), 'devnet', 'devnet.init.mjs')

let devnet: any

;(async () => {

  await testDevnetChainId()

  await testDevnetStateFile()

  await testDevnetUrl()

  await testDevnetContainer()

  await testDevnetHighLevel()

  //@ts-ignore
  await import('./Devnet.spec.ts.md')

})()

async function testDevnetChainId () {

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

async function testDevnetStateFile () {

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

async function testDevnetUrl () {

  assert.ok(
    devnet = new Devnet({ initScript }),
    "can construct with no options"
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

async function testDevnetContainer () {

  assert.ok(
    devnet = new Devnet({ initScript }),
    "can construct with explicitly enabled init script"
  )

  assert.equal(
    devnet.initScriptMount, '/devnet.init.mjs',
    "devnet init script mounted at default location"
  )

  assert.deepEqual(
    devnet.spawnEnv, {
      CHAIN_ID:  devnet.chainId,
      ACCOUNTS:  devnet.accounts.join(' '),
      STATE_UID: String(getuid!()),
      STATE_GID: String(getgid!()),
      LCP_PORT:  String(devnet.port)
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
    devnet.assertPresence(),
    "devnet assert presence rejects if container is removed"
  )

}

async function testDevnetHighLevel () {

  assert.ok(
    devnet = new Devnet(),
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
