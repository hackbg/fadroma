import assert from 'node:assert'
import { UploadStore, DeployStore } from './store'
import { UploadedCode } from './code'
import { Deployment } from './deploy'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['upload', testUploadStore],
  ['deploy', testDeployStore],
])

export async function testUploadStore () {
  const uploadStore = new UploadStore()
  assert.equal(uploadStore.get('name'), undefined)
  assert.equal(uploadStore.set('name', {}), uploadStore)
  assert.throws(()=>uploadStore.set('foo', { codeHash: 'bar' }))
  assert(uploadStore.get('name') instanceof UploadedCode)
}

export async function testDeployStore () {
  const deployStore = new DeployStore()
  assert.equal(deployStore.get('name'), undefined)
  assert.equal(deployStore.set('name', {}), deployStore)
  assert(deployStore.get('name') instanceof Deployment)
}
