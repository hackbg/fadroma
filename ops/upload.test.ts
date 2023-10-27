import { MyDeployment } from './deploy.test'
import { StubAgent, UploadStore } from '@fadroma/connect'

export default async function testUpload () {

  const deployment = new MyDeployment()

  await deployment.upload({
    agent: new StubAgent(),
    uploadStore: new UploadStore('')
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
