import assert from 'node:assert'
import { Project, ProjectWizard } from '@hackbg/fadroma'
import { withTmpDir } from '@hackbg/file'

export const tmpDir = () => {
  let x
  withTmpDir(dir=>x=dir)
  return x
}

assert(await new ProjectWizard({ interactive: false, cwd: tmpDir() }).createProject(
  'test-project-2',
  'test3',
  'test4'
) instanceof Project)
