/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Console } from './base'
import { Deployment, DeploymentContractLabel } from './deploy'
import { StubAgent, StubBuilder } from './stub'
import { CompiledCode } from './code'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['deployment', testDeployment],
  ['labels',     testDeploymentLabels],
])

export async function testDeployment () {

  class MyBuildableDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.template('template1', {
      repository: "foo",
    })
  }

  await new MyBuildableDeployment().build({
    builder: new StubBuilder()
  })

  class MyDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.contract('contract1', {
      codeId:  '2',
      label:   "contract1",
      initMsg: {}
    })
    contract2 = this.template1.contract('contract2', {
      label:   "contract2",
      initMsg: {}
    })
    contracts3 = this.template1.contracts({
      contract3a: { label: 'contract3a', initMsg: {} },
      contract3b: { label: 'contract3b', initMsg: {} },
    })
  }

  await new MyDeployment().contract1.deploy({
    deployer: new StubAgent()
  })

  new MyDeployment().contract1.toReceipt()

  new MyDeployment().toReceipt()

  assert.throws(()=>new MyDeployment().set('foo', {} as any))

  await new MyDeployment().upload({
    builder:  new StubBuilder(),
    uploader: new StubAgent(),
  })

  await new MyDeployment().deploy({
    builder:  new StubBuilder(),
    uploader: new StubAgent(),
    deployer: new StubAgent(),
  })

  new Console().deployment(new MyDeployment())

  assert((await new StubBuilder().build('')) instanceof CompiledCode)
  assert((await new StubBuilder().buildMany([{}]))[0] instanceof CompiledCode)
}

export async function testDeploymentLabels () {
  const label1 = new DeploymentContractLabel('foo', 'bar', 'baz')
  assert.equal(label1.toString(), 'foo/bar+baz')
  const label2 = DeploymentContractLabel.parse('foo/bar+baz')
  assert(label2 instanceof DeploymentContractLabel)
  assert.deepEqual(label2, { prefix: 'foo', name: 'bar', suffix: 'baz' })
  assert.deepEqual(label2.toString(), 'foo/bar+baz')

  const RE = DeploymentContractLabel.RE_LABEL
  DeploymentContractLabel.RE_LABEL = /1/
  assert.throws(()=>DeploymentContractLabel.parse(''))
  DeploymentContractLabel.RE_LABEL = /(?<prefix>.+)?/
  assert.throws(()=>DeploymentContractLabel.parse('foo/+baz'))
  DeploymentContractLabel.RE_LABEL = RE
}
