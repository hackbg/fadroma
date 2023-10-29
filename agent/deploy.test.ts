import assert from 'node:assert'
import { Console } from './base'
import { Deployment, DeploymentContractLabel } from './deploy'
import { StubAgent, StubBuilder } from './stub'
import { CompiledCode } from './code'

export async function testDeployment () {
  // deployment can define contracts and templates
  const deployment = new Deployment({ name: 'deployment' })
  assert.deepEqual(deployment.toReceipt(), { name: 'deployment', units: {} })
  const template1 = deployment.template('template1', {
    codeHash: "asdf", codeData: new Uint8Array([1]),
  })
  await deployment.upload({ builder: new StubBuilder(), uploader: new StubAgent() })
  const contract1 = deployment.contract('contract1', {
    codeId: '2', label: "contract1", initMsg: {}
  })
  await deployment.deploy({ uploader: new StubAgent(), deployer: new StubAgent() })
  // pretty print deployment 
  new Console().deployment(deployment)
  // deployment label format

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
}
