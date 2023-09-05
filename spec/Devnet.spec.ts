//import './Devnet.spec.ts.md'

import { Devnet } from '@hackbg/fadroma'
import * as assert from 'node:assert'
import { getuid, getgid } from 'node:process'
import $, { TextFile } from '@hackbg/file'
import { Image, Container } from '@hackbg/dock'

let devnet

;(async () => {

  assert.throws(() => { devnet = new Devnet({ chainId: false as any }) })
  assert.ok(devnet = new Devnet())
  assert.ok(await devnet.save())
  assert.ok(devnet = new Devnet({ chainId: devnet.chainId }))
  assert.ok(await devnet.delete())
  assert.ok(devnet = new Devnet({ chainId: devnet.chainId }))
  assert.ok(await devnet.save())
  $(devnet.stateFile).as(TextFile).save("invalidjson")
  assert.throws(()=>{ devnet = new Devnet({ chainId: devnet.chainId }) })
  $(devnet.stateFile).as(TextFile).save("null")
  assert.ok(devnet = new Devnet({ chainId: devnet.chainId }))
  assert.ok(await devnet.delete())
  assert.ok(devnet = new Devnet())
  assert.equal(devnet.url.toString(), `http://${devnet.host}:${devnet.port}/`)
  assert.ok((await devnet.image) instanceof Image)
  assert.equal(devnet.initScriptMount, '/devnet.init.mjs')
  assert.deepEqual(devnet.spawnEnv, {
    Verbose: '',
    ChainId: devnet.chainId,
    GenesisAccounts: devnet.accounts.join(' '),
    _UID: getuid(),
    _GID: getgid(),
    lcpPort: String(devnet.port)
  })
  const spawnPort = `${String(devnet.port)}/tcp`
  assert.deepEqual(devnet.spawnOptions.env, devnet.spawnEnv)
  assert.deepEqual(devnet.spawnOptions.exposed, [ spawnPort ])
  assert.deepEqual(devnet.spawnOptions.extra.HostConfig.PortBindings, {
    [spawnPort]: [ { HostPort: String(devnet.port) } ]
  })
  assert.equal(await devnet.container, undefined)
  assert.ok(await devnet.create())
  assert.ok((await devnet.container) instanceof Container)
  assert.ok(await devnet.assertPresence() || true)
  assert.ok(await devnet.create())
  ;(await devnet.container).remove()
  assert.rejects(devnet.assertPresence())
  assert.ok(devnet = new Devnet())
  assert.ok(await devnet.start())
  assert.ok(await devnet.assertPresence() || true)
  assert.ok(await devnet.pause())
  assert.ok(await devnet.export())
  assert.ok(await devnet.forceDelete() || true)

})()
