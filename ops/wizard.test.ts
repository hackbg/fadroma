import * as assert from 'node:assert'
import { ProjectWizard } from './wizard'
import { Project } from './project'
import { withTmpDir } from '@hackbg/file'

export default async function testProjectWizard () {

  const wizard = new ProjectWizard({
    interactive: false,
    cwd: tmpDir()
  })

  assert.ok(await wizard.createProject(
    Project,
    'test-project-2',
    'test3',
    'test4'
  ) instanceof Project)

}

export function tmpDir () {
  let x
  withTmpDir(dir=>x=dir)
  return x
}
