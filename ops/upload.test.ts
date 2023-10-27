/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { MyDeployment } from './deploy.test'
import { StubAgent, UploadStore } from '@fadroma/connect'

export default async function testUpload () {

  const deployment = new MyDeployment()

  await deployment.upload({
    agent: new StubAgent(),
    uploadStore: new UploadStore()
  })

}

//export async function testUploadStore () {
  //let uploader: FSUploader
  //let agent:    Agent = { chain: { id: 'testing' }, upload: async (x: any) => x } as any // mock

  ////await withTmpDir(async store=>{
    ////uploader = new FSUploader({ agent, store })
    ////assert.ok(uploader.agent === agent)
    ////assert.ok(await uploader.upload(template))
    ////assert.ok(await uploader.upload(template))
    ////assert.ok(await uploader.uploadMany([template]))
  ////})
//}
