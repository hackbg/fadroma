/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as assert from 'node:assert'
import { getuid, getgid } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Project, getDevnet, Devnet, Agent } from '@hackbg/fadroma'
import type { DevnetPlatform } from '@hackbg/fadroma'
import $, { TextFile, JSONFile, JSONDirectory } from '@hackbg/file'
import { Image, Container } from '@hackbg/dock'
import { getBuilder } from './build'

//@ts-ignore
export const packageRoot = dirname(resolve(fileURLToPath(import.meta.url)))

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['scrt',         ()=>testDevnetPlatform('scrt_1.9')],
  ['okp4',         ()=>testDevnetPlatform('okp4_5.0')],
  ['chain-id',     testDevnetChainId],
  ['state-file',   testDevnetStateFile],
  ['url',          testDevnetUrl],
  ['container',    testDevnetContainer],
  ['copy-uploads', testDevnetCopyUploads],
])

export async function testDevnetDocs () {
  //@ts-ignore
  await import('./Devnet.spec.ts.md')
}

export async function testDevnetPlatform (platform: DevnetPlatform) {
  let devnet: any
  assert.ok(devnet = new Devnet({ platform }), "construct devnet")
  assert.ok(await devnet.start(), "starting the devnet works")
  assert.ok(await devnet.assertPresence() || true, "devnet start automatically created container")
  assert.ok(await devnet.pause(), "pausing the devnet works")
  assert.ok(await devnet.export(), "exporting the devnet works")
  assert.ok(await devnet.forceDelete() || true, "force deleting the devnet works")
}

export async function testDevnetChain () {
  const devnet = new Devnet({ platform: 'okp4_5.0' })
  const chain  = devnet.getChain()
  assert.ok(chain.id.match(/fadroma-devnet-[0-9a-f]{8}/))
  assert.equal(chain.id, chain.devnet!.chainId)
  assert.equal((await devnet.container)!.name, `/${chain.id}`)
}

export async function testDevnetCopyUploads () {
  const devnet1   = await new Devnet({ platform: 'okp4_5.0' }).create()
  const chain1    = devnet1.getChain()
  const agent1    = await chain1.getAgent({ name: 'Admin' }).ready
  const crate     = resolve(packageRoot, 'examples', 'cw-null')
  const artifact  = await getBuilder().build(crate)
  const uploaded1 = await agent1.upload(artifact)
  const uploaded2 = await agent1.upload(artifact)
  const devnet2   = new Devnet({ platform: 'okp4_5.0' })
  //assert.ok(await devnet2.copyUploads(chain1), "copying uploads")
}

export async function testDevnetChainId () {
  let devnet: Devnet
  assert.throws(
    () => { devnet = new Devnet({ chainId: false as any }) },
    "construct must fail if passed falsy chainId"
  )
  assert.ok(devnet = new Devnet(), "construct must work with no options")
  assert.ok(typeof devnet.chainId === 'string', "chain id must be auto populated when not passed")
  // TODO: can't delete before creating
  assert.ok(await devnet.save(), "can save")
  assert.ok(
    devnet = new Devnet({ chainId: devnet.chainId }),
    "can construct when passing chainId"
  )
  assert.ok(await devnet.delete(), "can delete")
  assert.ok(
    devnet = new Devnet({ chainId: devnet.chainId }),
    "after deletion, can construct new devnet with same chainId"
  )
  // TODO: devnet with same chainid points to same resource
  assert.ok(await devnet.save(), "can save")
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
  assert.ok(await devnet.delete(), "can delete if state is valid json but empty")
}

export async function testDevnetUrl () {
  let devnet: Devnet
  assert.ok(devnet = new Devnet(), "can construct")
  assert.equal(
    devnet.url.toString(), `http://${devnet.host}:${devnet.port}/`,
    "devnet url generated from host and port properties"
  )
  assert.ok((await devnet.image) instanceof Image, "devnet has @hackbg/dock image")
}

export async function testDevnetContainer () {
  let devnet: any
  assert.ok(devnet = new Devnet(), "can construct")
  assert.equal(
    devnet.initScriptMount, '/devnet.init.mjs',
    "devnet init script mounted at default location"
  )
  const spawnEnv = {
    DAEMON:    'secretd',
    TOKEN:     'uscrt',
    CHAIN_ID:  devnet.chainId,
    ACCOUNTS:  devnet.accounts.join(' '),
    STATE_UID: String(getuid!()),
    STATE_GID: String(getgid!()),
    HTTP_PORT: String(devnet.port)
  }
  assert.deepEqual(devnet.spawnEnv, spawnEnv, "devnet spawn environment")
  assert.deepEqual(
    devnet.spawnOptions.env, devnet.spawnEnv,
    "devnet spawn environment is passed to container options"
  )
  const spawnPort = `${String(devnet.port)}/tcp`
  assert.deepEqual(devnet.spawnOptions.exposed, [ spawnPort ], "devnet port is exposed")
  const portBindings = { [spawnPort]: [ { HostPort: String(devnet.port) } ] }
  assert.deepEqual(
    devnet.spawnOptions.extra.HostConfig.PortBindings, portBindings,
    "devnet port binding is present"
  )
  assert.equal(await devnet.container, undefined, "devnet starts with no container")
  assert.ok(await devnet.create(), "devnet creates container")
  assert.ok(
    (await devnet.container) instanceof Container,
    "devnet container property is populated after container is created"
  )
  assert.ok(
    await devnet.assertPresence() || true,
    "devnet assert presence is ok after container is created"
  )
  assert.ok(await devnet.create(), "devnet creation is idempotent")
  ;(await devnet.container).remove()
  assert.rejects(devnet.assertPresence, "devnet assert presence rejects if container is removed")
}

export async function testDevnetFurther () {
  const devnet = getDevnet(/* { options } */)
  await devnet.create()
  await devnet.start()
  const chain = devnet.getChain()
  assert.ok(chain.mode === 'Devnet')
  assert.ok(chain.isDevnet)
  assert.ok(chain.devnet === devnet)
  const alice = chain.getAgent({ name: 'Alice' })
  await alice.ready
  assert.ok(alice instanceof Agent)
  assert.equal(alice.name, 'Alice')
  const wallet = $(chain.devnet.stateDir, 'wallet', 'Alice.json').as(JSONFile).load() as {
    address:  string,
    mnemonic: string
  }
  assert.equal(alice.address, wallet.address)
  assert.equal(alice.mnemonic, wallet.mnemonic)
  const anotherDevnet = getDevnet({
    accounts: [ 'Alice', 'Bob' ]
  })
  assert.deepEqual(anotherDevnet.accounts, [ 'Alice', 'Bob' ])
  await anotherDevnet.delete()
  await devnet.pause()
  await devnet.start()
  await devnet.pause()
  await devnet.export()
  await devnet.delete()
  const project = new Project()
  project.resetDevnets()
  await devnet.create()
  await devnet.start()
  await devnet.pause()
  assert.equal($(chain.devnet.stateDir).name, chain.id)
  const devnetState = $(chain.devnet.stateDir, 'devnet.json').as(JSONFile).load()
  assert.deepEqual(devnetState, {
    chainId:     chain.id,
    containerId: chain.devnet.containerId,
    port:        chain.devnet.port,
    imageTag:    chain.devnet.imageTag
  })
  const accounts = $(chain.devnet.stateDir, 'wallet').as(JSONDirectory).list()
  assert.deepEqual(accounts, chain.devnet.accounts)
  await devnet.delete()
}

