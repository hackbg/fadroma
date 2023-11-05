/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { Console } from './base'
import { Deployment, DeploymentContractLabel, ContractInstance } from './deploy'
import { ContractClient } from './client'
import * as Stub from './stub'
import { CompiledCode } from './code'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['units',      testDeploymentUnits],
  ['deployment', testDeployment],
  ['labels',     testDeploymentLabels],
])

export async function testDeploymentUnits () {
  const contract = new ContractInstance({ address: 'present' })
  assert.equal(await contract.deploy(), contract)
  assert(contract.connect(new Stub.Agent()) instanceof ContractClient)

  assert.rejects(()=>new ContractInstance({
    uploaded: { codeId: 123 } as any,
  }).deploy())

  assert.rejects(()=>new ContractInstance({
    uploaded: { codeId: 123 } as any,
    deployer: 'onlyaddress'
  }).deploy())

  assert.rejects(()=>new ContractInstance({
    uploaded: { codeId: 123 } as any,
    deployer: { instantiate: ((...args: any) => Promise.resolve({ isValid: () => false })) } as any
  }).deploy())
}

export async function testDeployment () {

  class MyBuildableDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.template('template1', {
      sourcePath: "foo",
    })
  }

  await new MyBuildableDeployment().build({
    compiler: new Stub.Compiler()
  })

  class MyDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.contract('contract1', {
      chainId: 'stub',
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
    deployer: new Stub.Agent()
  })

  new MyDeployment().contract1.serialize()

  new MyDeployment().serialize()

  MyDeployment.fromSnapshot(new MyDeployment().serialize())

  assert.throws(()=>new MyDeployment().set('foo', {} as any))

  await new MyDeployment().upload({
    compiler: new Stub.Compiler(),
    uploader: new Stub.Agent(),
  })

  await new MyDeployment().deploy({
    compiler: new Stub.Compiler(),
    uploader: new Stub.Agent(),
    deployer: new Stub.Agent(),
  })
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
