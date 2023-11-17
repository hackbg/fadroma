/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/

import { ok, equal, deepEqual, throws, rejects } from 'node:assert'
import { getuid, getgid } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import $, { TextFile, JSONFile, JSONDirectory } from '@hackbg/file'
import * as Dock from '@hackbg/dock'

import { Connection, Scrt, CW, Token, CompiledCode } from '@hackbg/fadroma'

import { fixture } from '../fixtures/fixtures'
import * as Devnets from './devnet'

//@ts-ignore
export const packageRoot = dirname(dirname(resolve(fileURLToPath(import.meta.url))))

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['scrt', ()=>testDevnetPlatform(Scrt.Connection,    Devnets.ScrtContainer, 'v1.9', 'secretd')],
  ['okp4', ()=>testDevnetPlatform(CW.OKP4.Connection, Devnets.OKP4Container, 'v5.0', 'okp4d')],
])

export async function testDevnetPlatform <
  A extends typeof Connection, D extends typeof Devnets.Container,
> (
  Connection: A, Devnet: D, version: string, daemon: string
) {
  const codePath = resolve(packageRoot, 'fixtures', 'fadroma-example-cw-null@HEAD.wasm')
  let devnet: InstanceType<D> = new (Devnet as any)({
    genesisAccounts: {
      User1: 12345678,
      User2: 87654321,
    },
    genesisUploads: {
      '7': {
        codePath: fixture('fadroma-example-cw-null@HEAD.wasm')
      },
      '8': {
        codePath: fixture('fadroma-example-cw-echo@HEAD.wasm')
      },
    }
  })
  ok(devnet, "construct devnet")
  ok(typeof devnet.chainId === 'string')
  equal(devnet.initScriptMount, '/devnet.init.mjs')
  ok((await devnet.image) instanceof Dock.Image)
  deepEqual(devnet.spawnEnv.DAEMON,    daemon)
  deepEqual(devnet.spawnEnv.TOKEN,     Connection.gasToken.denom)
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
  ok((await devnet.container) instanceof Dock.Container)
  equal((await devnet.container)!.name, `/${devnet.chainId}`)

  ok(await devnet.start())
  const agent = await devnet.connect({ name: 'User1' })
  ok(agent instanceof Connection)
  equal(agent.chainId, devnet.chainId)
  equal(agent.url, devnet.url)

  ok(await devnet.pause())
  ok(await devnet.export())
  ok(await devnet.delete())

  //ok(await devnet.create(), "devnet creation is idempotent")
  //;(await devnet.container).remove()
  //$(devnet.stateFile).as(TextFile).save("invalidjson")
  //throws(
    //()=>{ devnet = new Devnets.Container({ platform: 'scrt_1.9' }) },
    //"can't construct if state is invalid json"
  //)
  //$(devnet.stateFile).as(TextFile).save("null")
  //ok(devnet = new Devnet(),
    //"can construct if state is valid json but empty")
  //ok(await devnet.delete(), "can delete if state is valid json but empty")
}
