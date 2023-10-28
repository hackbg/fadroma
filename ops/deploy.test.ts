/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as assert from 'node:assert'
import { Deployment, ContractUpload, ContractInstance, StubAgent } from '@fadroma/connect'
import { Suite } from '@hackbg/ensuite'
import { DeployConsole, FSDeployStore } from './deploy'

export class MyDeployment extends Deployment {
  t = this.template('t', {
    codeId: '1',
    crate:  'examples/kv'
  })

  // Single template instance with eager and lazy initMsg
  a1 = this.t.instance({ name: 'a1', initMsg: {} })
  a2 = this.t.instance({ name: 'a2', initMsg: () => ({}) })
  a3 = this.t.instance({ name: 'a3', initMsg: async () => ({}) })

  // Multiple template instances as array
  // with varying initMsg eagerness
  b = this.t.instances([
    { name: 'b1', initMsg: {} },
    { name: 'b2', initMsg: () => ({}) },
    { name: 'b3', initMsg: async () => ({}) }
  ])

  // Multiple template instances as object
  // with varying initMsg eagerness
  // (named automatically)
  c = this.t.instances({
    c1: { initMsg: {} },
    c2: { initMsg: () => ({}) },
    c3: { initMsg: async () => ({}) }
  })
}

export async function testDeployment () {
  const deployment = new MyDeployment()
  assert.ok(
    deployment.t instanceof ContractUpload
  )
  await deployment.deploy({
    uploader: new StubAgent(),
    deployer: new StubAgent()
  })
  assert.ok([
    deployment.a1,
    deployment.a2,
    deployment.a3,
    ...Object.values(deployment.b),
    ...Object.values(deployment.c),
  ].every(
    c=>c instanceof ContractInstance
  ))
}

class V1Deployment extends Deployment {
  kv1 = this.contract('kv1', { crate: 'examples/kv', initMsg: {} })
  kv2 = this.contract('kv2', { crate: 'examples/kv', initMsg: {} })
}

class V2Deployment extends V1Deployment {
  kv3 = this.contract('kv3', { crate: 'examples/kv', initMsg: {} })
  // simplest client-side migration is to just instantiate
  // a new deployment with the data from the old deployment.
  static upgrade = (previous: V1Deployment) => new this({
    ...previous
  })
}

export async function testDeploymentUpgrade () {

  let deployment = new V1Deployment()
  assert.deepEqual(deployment.keys(), ['kv1', 'kv2'])
  const mainnetAgent: any = { chain: { isMainnet: true } } // mock
  const testnetAgent: any = { chain: { isTestnet: true } } // mock
  // simplest chain-side migration is to just call default deploy,
  // which should reuse kv1 and kv2 and only deploy kv3.
  let deployment2 = await V2Deployment.upgrade(deployment).deploy({
    uploader: new StubAgent(),
    deployer: new StubAgent()
  })
}

export function testDeployConsole () {
  new DeployConsole('test message')
    .activating('asdf')
    .list('asdf', new FSDeployStore('', {}))
}

export default new Suite([
  ['basic',   testDeployment],
  ['upgrade', testDeploymentUpgrade],
  ['console', testDeployConsole]
])
