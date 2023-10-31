/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as assert from 'node:assert'
import type { Project } from './project'
import { UploadedCode } from '@fadroma/connect'

export default async function testProject () {
  const { Project } = await import('@hackbg/fadroma')
  const { tmpDir } = await import('../fixtures/fixtures')
  const root = tmpDir()
  let project: Project = new Project({
    root: `${root}/test-project-1`,
    name: 'test-project-1',
  })
    .create()
    .status()
    .cargoUpdate()

  await project.build()
  await project.build('test1')
  await project.upload()
  await project.upload('test1')
  await project.deploy(/* any deploy arguments, if you've overridden the deploy procedure */)
  await project.redeploy(/* ... */)
  await project.exportDeployment('state')
}
