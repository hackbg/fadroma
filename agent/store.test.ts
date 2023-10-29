import assert from 'node:assert'
import { UploadStore, DeployStore } from './store'
import { UploadedCode } from './code'
import { Deployment } from './deploy'

export async function testStores () {

  // deploy store converts inputs to UploadedCode instances
  const uploadStore = new UploadStore()
  assert.equal(uploadStore.get('name'), undefined)
  assert.equal(uploadStore.set('name', {}), uploadStore)
  console.log(uploadStore.get('name'))
  assert(uploadStore.get('name') instanceof UploadedCode)

  // deploy store converts inputs to Deployment instances
  const deployStore = new DeployStore()
  assert.equal(deployStore.get('name'), undefined)
  assert.equal(deployStore.set('name', {}), deployStore)
  assert(deployStore.get('name') instanceof Deployment)

}
