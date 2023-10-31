/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
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
  const deployment = new Deployment({ name: 'foo' })
  assert.equal(deployStore.set('name', deployment), deployStore)
  assert.deepEqual(deployStore.get('name'), deployment.toReceipt())
}
