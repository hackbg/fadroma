/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
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
