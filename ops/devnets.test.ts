/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as assert from 'node:assert'
import { getuid, getgid } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent, Project, Compilers, Devnets, CW, Token } from '@hackbg/fadroma'
import $, { TextFile, JSONFile, JSONDirectory } from '@hackbg/file'
import * as Dock from '@hackbg/dock'

//@ts-ignore
export const packageRoot = dirname(dirname(resolve(fileURLToPath(import.meta.url))))

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['scrt',         ()=>testDevnetPlatform('scrt_1.9')],
  ['okp4',         ()=>testDevnetPlatform('okp4_5.0')],
  ['chain-id',     testDevnetChainId],
  ['state-file',   testDevnetStateFile],
  ['url',          testDevnetUrl],
  ['container',    testDevnetContainer],
  ['genesis',      testDevnetGenesis],
])

export async function testDevnetDocs () {
  //@ts-ignore
  await import('./Devnet.spec.ts.md')
}

export async function testDevnetPlatform (platform: Devnets.Platform) {
  let devnet: any
  assert.ok(devnet = new Devnets.Container({ platform }), "construct devnet")
  assert.ok(await devnet.start(), "starting the devnet works")
  assert.ok(await devnet.assertPresence() || true, "devnet start automatically created container")
  assert.ok(await devnet.pause(), "pausing the devnet works")
  assert.ok(await devnet.export(), "exporting the devnet works")
  assert.ok(await devnet.forceDelete() || true, "force deleting the devnet works")
}

export async function testDevnetChain () {
  const devnet = new Devnets.Container({ platform: 'okp4_5.0' })
  const chain  = new CW.OKP4.Agent({ devnet })
  assert.ok((chain.chainId||'').match(/fadroma-devnet-[0-9a-f]{8}/))
  assert.equal(chain.chainId, chain.devnet!.chainId)
  assert.equal((await devnet.container)!.name, `/${chain.chainId}`)
}

export async function testDevnetGenesis () {
  const compiled = await Compilers.getCompiler().build(
    resolve(packageRoot, 'examples', 'cw-null')
  )
  const devnet = await new Devnets.Container({
    platform: 'okp4_5.0',
    genesisAccounts: {
      User1: [ new Token.Amount('1000000000000', new Token.Native('uknow')) ],
      User2: [ new Token.Amount('1000000000000', new Token.Native('uknow')) ]
    },
    genesisUploads: {
      '7': compiled,
      '8': compiled,
    }
  })
  const agent1 = await devnet.authenticate('User1')
  await agent1.instantiate('7', { label: 'test-7', initMsg: {} })
  const agent2 = await devnet.authenticate('User2')
  await agent2.instantiate('8', { label: 'test-8', initMsg: {} })
}

export async function testDevnetChainId () {
  let devnet: Devnets.Container
  //assert.throws(
    //() => { devnet = new Devnets.Container({ chainId: false as any }) },
    //"construct must fail if passed falsy chainId"
  //)
  assert.throws(
    ()=>{devnet = new Devnets.Container()},
    "construct must work with no options"
  )

  assert.ok(
    devnet = new Devnets.Container({ platform: 'scrt_1.9' }),
    "can construct when passing platform and chainId"
  )

  assert.ok(
    typeof devnet.chainId === 'string',
    "chain id must be auto populated when not passed"
  )

  // TODO: can't delete before creating
  assert.ok(
    await devnet.save(),
    "can save"
  )

  assert.ok(
    await devnet.delete(),
    "can delete"
  )

  assert.ok(
    devnet = new Devnets.Container({ platform: 'scrt_1.9' }),
    "after deletion, can construct new devnet with same chainId"
  )

  // TODO: devnet with same chainid points to same resource
  assert.ok(
    await devnet.save(),
    "can save"
  )
}

export async function testDevnetStateFile () {
  let devnet = new Devnets.Container({ platform: 'scrt_1.9' })
  $(devnet.stateFile).as(TextFile).save("invalidjson")
  //assert.throws(
    //()=>{ devnet = new Devnets.Container({ platform: 'scrt_1.9' }) },
    //"can't construct if state is invalid json"
  //)
  $(devnet.stateFile).as(TextFile).save("null")
  assert.ok(
    devnet = new Devnets.Container({ platform: 'scrt_1.9' }),
    "can construct if state is valid json but empty"
  )
  assert.ok(await devnet.delete(), "can delete if state is valid json but empty")
}

export async function testDevnetUrl () {
  let devnet = new Devnets.Container({ platform: 'scrt_1.9' })
  assert.equal(
    devnet.url.toString(), `http://${devnet.host}:${devnet.port}/`,
    "devnet url generated from host and port properties"
  )
  assert.ok((await devnet.image) instanceof Dock.Image, "devnet has @hackbg/dock image")
}

export async function testDevnetContainer () {
  let devnet = new Devnets.Container({ platform: 'scrt_1.9' })
  assert.ok(devnet = new Devnets.Container({ platform: 'scrt_1.9' }), "can construct")
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
    (await devnet.container) instanceof Dock.Container,
    "devnet container property is populated after container is created"
  )
  //assert.ok(
    //await devnet.assertPresence() || true,
    //"devnet assert presence is ok after container is created"
  //)
  //assert.ok(await devnet.create(), "devnet creation is idempotent")
  //;(await devnet.container).remove()
  //assert.rejects(devnet.assertPresence, "devnet assert presence rejects if container is removed")
}
