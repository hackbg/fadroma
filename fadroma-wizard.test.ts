import assert from 'node:assert'
import Project from '@hackbg/fadroma'
import { withTmpDir } from '@hackbg/file'
import { ProjectWizard } from '../fadroma-wizard'

import testEntrypoint from './testSelector'
export default testEntrypoint(import.meta.url, {
  'docs': () => import('./Project.spec.ts.md'),
  'wizard': testProjectWizard
})

export const tmpDir = () => {
  let x
  withTmpDir(dir=>x=dir)
  return x
}

export async function testProjectWizard () {
  assert(await new ProjectWizard({ interactive: false, cwd: tmpDir() }).createProject(
    Project,
    'test-project-2',
    'test3',
    'test4'
  ) instanceof Project)
}
