/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as assert from 'node:assert'
import { MyDeployment } from './deploy.test'
import { getCompiler, getGitDir, DotGit } from './build'
import { Compiler, ContractInstance } from '@fadroma/connect'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['basic',   testBuild],
  ['history', testBuildHistory]
])

export async function testBuild () {
  const deployment = new MyDeployment()
  await deployment.build({ compiler: getCompiler() })
  const compiler = getCompiler(/* { ...options... } */)
  assert.ok(compiler instanceof Compiler)

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
  //assert.throws(()=>getGitDir(new ContractInstance()))
  //const contractWithSource = new ContractInstance({
    //repository: 'REPO',
    //revision:   'REF',
    //workspace:  'WORKSPACE',
    //crate:      'CRATE'
  //})
  //assert.ok(getGitDir(contractWithSource) instanceof DotGit)
}

