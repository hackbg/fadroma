/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { deepEqual, throws } from 'node:assert'
import { Compiler, ContractInstance, Deployment } from '@fadroma/agent'
import {
  getCompiler,
  RawLocalRustCompiler,
  ContainerizedLocalRustCompiler
} from './compile'
import { fixture, TestBuildDeployment } from '../fixtures/fixtures'
import { Suite } from '@hackbg/ensuite'
import * as Dock from '@hackbg/dock'
import { DotGit } from '@hackbg/repo'

export default new Suite([
  ['basic',     testBuild],
  ['container', testBuildContainer],
  ['history',   testBuildHistory]
])

/** Different config options for containerized compiler. */
export async function testBuildContainer () {
  new ContainerizedLocalRustCompiler({
    dockerSocket: '/dev/null'
  })
  new ContainerizedLocalRustCompiler({
    docker: { image: () => {} } as any
  })
  new ContainerizedLocalRustCompiler({
    dockerImage: {} as any
  })
  new ContainerizedLocalRustCompiler({
    dockerImage: new Dock.Docker.Image(null, 'test') as any
  })
}

export async function testBuild () {

  for (const useContainer of [ true, false ]) {
    const compiler = getCompiler({ useContainer })
    assert(compiler)
    compiler[Symbol.toStringTag as unknown as keyof typeof compiler]
    assert(compiler instanceof Compiler)

    const deployment = new TestBuildDeployment()
    await deployment.build({ compiler })

    deepEqual((compiler as any).resolveSource('foo'), { cargoCrate: 'foo' })
    throws(()=>(compiler as any).resolveSource({ cargoWorkspace: 'yes' }))
  }

  //assert.ok(getCompiler({ raw: false }) instanceof BuildContainer)
  //assert.ok(getCompiler({ raw: false }).docker instanceof Dock.Engine)
  //getCompiler({ raw: false, dockerSocket: 'test' })
  //const rawCompiler = getCompiler({ raw: true })
  //assert.ok(rawCompiler instanceof BuildRaw)
  //for (const raw of [true, false]) {
    //const compiler = getCompiler({ raw })
    //const contract_0 = await compiler.build({ crate: 'examples/kv' })
    //const [contract_1, contract_2] = await compiler.buildMany([
      //{ crate: 'examples/admin' },
      //{ crate: 'examples/killswitch' }
    //])
    //for (const [contract, index] of [ contract_0, contract_1, contract_2 ].map((c,i)=>[c,i]) {
      //assert.ok(typeof contract.codeHash === 'string', `contract_${index}.codeHash is set`)
      //assert.ok(contract.artifact instanceof URL,      `contract_${index}.artifact is set`)
      //assert.ok(contract.workspace, `contract_${index}.workspace is set`)
      //assert.ok(contract.crate,     `contract_${index}.crate is set`)
      //assert.ok(contract.revision,  `contract_${index}.revision is set`)
    //}
  //}
  //const contract: Contract<any> = new Contract({ compiler, crate: 'fadroma-example-kv' })
  //const template = new Template({ compiler, crate: 'fadroma-example-kv' })
  //await template.compiled
}

export async function testBuildHistory () {
  let gitDir
  assert(new DotGit(process.cwd()))
}
