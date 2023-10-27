import * as assert from 'node:assert'
import type { Project } from './project'
import { ContractTemplate } from '@fadroma/connect'

export default async function testProject () {
  const { Project } = await import('@hackbg/fadroma')
  const { tmpDir } = await import('../fixtures/fixtures')
  const root = tmpDir()
  let project: Project = new Project({
    root: `${root}/test-project-1`,
    name: 'test-project-1',
    templates: {
      test1: { crate: 'test1' },
      test2: { crate: 'test2' },
    }
  })
    .create()
    .status()
    .cargoUpdate()
  const test1 = project.getTemplate('test1')
  assert.ok(test1 instanceof ContractTemplate)
  const test3 = project.setTemplate('test3', { crate: 'test2' })
  assert.ok(test3 instanceof ContractTemplate)
  await project.build()
  await project.build('test1')
  await project.upload()
  await project.upload('test1')
  await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
  await project.redeploy(/* ... */)
  await project.exportDeployment('state')
}
