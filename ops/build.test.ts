import * as assert from 'node:assert'
import { MyDeployment } from './deploy.test'
import { getBuilder, getGitDir, DotGit } from './build'
import { Builder, ContractInstance } from '@fadroma/connect'
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['basic',   testBuild],
  ['history', testBuildHistory]
])

export async function testBuild () {
  const deployment = new MyDeployment()
  await deployment.build({ builder: getBuilder() })
  const builder = getBuilder(/* { ...options... } */)
  assert.ok(builder instanceof Builder)

  //assert.ok(getBuilder({ raw: false }) instanceof BuildContainer)
  //assert.ok(getBuilder({ raw: false }).docker instanceof Dock.Engine)
  //getBuilder({ raw: false, dockerSocket: 'test' })
  //const rawBuilder = getBuilder({ raw: true })
  //assert.ok(rawBuilder instanceof BuildRaw)
  //for (const raw of [true, false]) {
    //const builder = getBuilder({ raw })
    //const contract_0 = await builder.build({ crate: 'examples/kv' })
    //const [contract_1, contract_2] = await builder.buildMany([
      //{ crate: 'examples/admin' },
      //{ crate: 'examples/killswitch' }
    //])
    //for (const [contract, index] of [ contract_0, contract_1, contract_2 ].map((c,i)=>[c,i]) {
      //assert.ok(typeof contract.codeHash === 'string', `contract_${index}.codeHash is set`)
      //assert.ok(contract.artifact instanceof URL,      `contract_${index}.artifact is set`)
      //assert.ok(contract.workspace, `contract_${index}.workspace is set`)
      //assert.ok(contract.crate,     `contract_${index}.crate is set`)
      //assert.ok(contract.revision,  `contract_${index}.revision is set`)
    //}
  //}
  //const contract: Contract<any> = new Contract({ builder, crate: 'fadroma-example-kv' })
  //const template = new Template({ builder, crate: 'fadroma-example-kv' })
  //await template.compiled
}

export async function testBuildHistory () {
  assert.throws(()=>getGitDir(new ContractInstance()))
  const contractWithSource = new ContractInstance({
    repository: 'REPO',
    revision:   'REF',
    workspace:  'WORKSPACE',
    crate:      'CRATE'
  })
  assert.ok(getGitDir(contractWithSource) instanceof DotGit)
}

