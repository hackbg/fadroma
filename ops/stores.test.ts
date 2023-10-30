/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { MyDeployment } from './deploy.test'
import { JSONFileUploadStore } from './stores'
import { StubAgent } from '@fadroma/connect'

export default async function testJSONFileUploadStore () {
  const deployment = new MyDeployment()
  await deployment.upload({
    uploader: new StubAgent(),
    uploadStore: new JSONFileUploadStore()
  })
}
