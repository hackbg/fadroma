import assert from 'node:assert'

import {
  Deployment,
  ContractCode,
  ContractInstance,
  DeployStore
} from './deploy'

import { Stub } from '@hackbg/fadroma'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['units',      testDeploymentUnits],
  ['deployment', testDeployment],
  ['deploy',     testDeployStore],
])

export async function testDeployStore () {
  const deployStore = new DeployStore()

  assert.equal(
    deployStore.get('name'), undefined
  )

  const deployment = new Deployment({ name: 'foo' })

  assert.equal(
    deployStore.set('name', deployment), deployStore
  )

  assert.deepEqual(
    deployStore.get('name'), deployment.serialize()
  )
}

export async function testDeploymentUnits () {
  const contract = new ContractInstance({ address: 'present' })

  assert.equal(
    await contract.deploy(), contract
  )

  assert(
    contract.connect(new Stub.Connection()) instanceof Contract
  )

  assert.rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
    }).deploy()
  )

  assert.rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
      deployer: 'onlyaddress'
    }).deploy()
  )

  assert.rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
      deployer: { instantiate: ((...args: any) => Promise.resolve({ isValid: () => false })) } as any
    }).deploy()
  )
}

export async function testDeployment () {

  const uploadStore = new UploadStore()
  const deployStore = new DeployStore()
  const compiler = new Stub.Compiler()
  const uploader = new Stub.Agent({})
  const deployer = uploader

  class MyBuildableDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.template('template1', {
      sourcePath: "foo",
    })
  }

  await new MyBuildableDeployment().build({ compiler })

  class MyDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.contract('contract1', {
      chainId:  'stub',
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
      label:    "contract1",
      initMsg:  {}
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
    deployer
  })

  new MyDeployment().contract1.serialize()

  new MyDeployment().serialize()

  assert(
    MyDeployment.fromSnapshot(new MyDeployment().serialize()))
  assert.throws(
    ()=>new MyDeployment().set('foo', {} as any))
  assert(
    await new MyDeployment().upload({ compiler, uploader }))
  assert(
    await new MyDeployment().deploy({ compiler, uploader, deployer }))
}
