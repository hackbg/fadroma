import { TestProjectDeployment } from './fixtures/fixtures'
import { JSONFileUploadStore } from './fadroma'
import { Stub } from '@fadroma/agent'
import { withTmpDir } from '@hackbg/file'
export default async function testJSONFileStores () {
  await withTmpDir(async dir=>{
    const deployment = new TestProjectDeployment()
    await deployment.upload({
      uploader:    new Stub.StubConnection(),
      uploadStore: new JSONFileUploadStore(dir)
    })
  })
}
