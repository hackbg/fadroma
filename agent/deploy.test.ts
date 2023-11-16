/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { equal, deepEqual, rejects, throws } from 'node:assert'
import { Contract } from './connec'
import * as Stub from './stub'
import {
  Deployment,
  ContractCode,
  ContractInstance,
  SourceCode,
  RustSourceCode,
  CompiledCode,
  UploadedCode,
  UploadStore,
  DeployStore
} from './deploy'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['units',      testDeploymentUnits],
  ['deployment', testDeployment],
  ['upload',     testUploadStore],
  ['deploy',     testDeployStore],
  ['compiler',   testCodeCompiler],
  ['units',      testCodeUnits],
  ['contract',   testCodeContract]
])

export async function testDeploymentUnits () {
  const contract = new ContractInstance({ address: 'present' })
  equal(
    await contract.deploy(), contract)
  assert(
    contract.connect(new Stub.Connection()) instanceof Contract)
  rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
    }).deploy())
  rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
      deployer: 'onlyaddress'
    }).deploy())
  rejects(
    ()=>new ContractInstance({
      uploaded: { codeId: 123 } as any,
      deployer: { instantiate: ((...args: any) => Promise.resolve({ isValid: () => false })) } as any
    }).deploy())
}

export async function testDeployment () {

  const uploadStore = new UploadStore()
  const deployStore = new DeployStore()
  const compiler = new Stub.Compiler()
  const uploader = new Stub.Connection()
  const deployer = uploader

  class MyBuildableDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.template('template1', {
      sourcePath: "foo",
    })
  }

  await new MyBuildableDeployment().build({ compiler })

  class MyDeployment extends Deployment {
    template1 = this.template('template1', {
      codeHash: "asdf",
      codeData: new Uint8Array([1]),
    })
    contract1 = this.contract('contract1', {
      chainId: 'stub',
      codeId:  '2',
      label:   "contract1",
      initMsg: {}
    })
    contract2 = this.template1.contract('contract2', {
      label:   "contract2",
      initMsg: {}
    })
    contracts3 = this.template1.contracts({
      contract3a: { label: 'contract3a', initMsg: {} },
      contract3b: { label: 'contract3b', initMsg: {} },
    })
  }

  await new MyDeployment().contract1.deploy({ deployer })

  new MyDeployment().contract1.serialize()

  new MyDeployment().serialize()

  assert(
    MyDeployment.fromSnapshot(new MyDeployment().serialize()))
  throws(
    ()=>new MyDeployment().set('foo', {} as any))
  assert(
    await new MyDeployment().upload({ compiler, uploader }))
  assert(
    await new MyDeployment().deploy({ compiler, uploader, deployer }))
}

export async function testUploadStore () {
  const uploadStore = new UploadStore()
  equal(
    uploadStore.get('name'), undefined)
  equal(
    uploadStore.set('name', {}), uploadStore)
  throws(
    ()=>uploadStore.set('foo', { codeHash: 'bar' }))
  assert(
    uploadStore.get('name') instanceof UploadedCode)
}

export async function testDeployStore () {
  const deployStore = new DeployStore()
  assert.equal(
    deployStore.get('name'), undefined)
  const deployment = new Deployment({ name: 'foo' })
  assert.equal(
    deployStore.set('name', deployment), deployStore)
  assert.deepEqual(
    deployStore.get('name'), deployment.serialize())
}
export async function testCodeContract () {
  //const contract1 = new ContractCode({
    //source:   new SourceCode(),
    //compiled: new CompiledCode(),
    //uploaded: new UploadedCode()
  //})
  //assert(contract1.source instanceof SourceCode)
  //assert(contract1.compiled instanceof CompiledCode)
  //assert(contract1.uploaded instanceof UploadedCode)
  //// can't compile missing code
  //rejects(()=>contract1.compile())
  //const validSource = new class extends SourceCode { isValid () { return true } }
  //const invalidSource = new class extends SourceCode { isValid () { return false } }
  //const brokenCompiler: any = { build: () => Promise.resolve({ isValid: () => false }) }
  //rejects(()=>new ContractCode({source: validSource}).compile({compiler: brokenCompiler}))
  //rejects(()=>new ContractCode({source: invalidSource}).compile({compiler: new Stub.Compiler()}))
  //assert(new ContractCode({ source: validSource }).compile({ compiler: new Stub.Compiler() }))
  //// can't upload missing code
  //rejects(()=>contract1.upload())
  //rejects(()=>contract1.upload({uploader: new Stub.Connection()}))
  //rejects(()=>contract1.upload({uploader: {upload: () => Promise.resolve({ isValid: () => false })} as any}))
  //assert(contract1.source[Symbol.toStringTag] || true)
  //assert(contract1.compiled[Symbol.toStringTag] || true)
  ////assert(contract1.uploaded[Symbol.toStringTag])
  ////assert(contract1.instance[Symbol.toStringTag])
  //rejects(()=>new CompiledCode().fetch())
  //rejects(()=>new CompiledCode({ codePath: '' }).fetch())
  //rejects(()=>new CompiledCode({ codePath: new URL('', 'file:') }).fetch())
  //rejects(()=>new CompiledCode({ codePath: new URL('http://foo.bar') }).fetch())
  //rejects(()=>new CompiledCode({ codePath: 0 as any }).fetch())
}

export async function testCodeCompiler () {
  assert((await new Stub.Compiler().build('')) instanceof CompiledCode)
  assert((await new Stub.Compiler().buildMany([{}]))[0] instanceof CompiledCode)
}

export async function testCodeUnits () {

  rejects(()=>new ContractCode({ }).compile())

  rejects(()=>new ContractCode({ compiler: new Stub.Compiler() }).compile())

  const source1 = new SourceCode()
  assert(source1[Symbol.toStringTag])
  deepEqual(source1.serialize(), {
    sourceOrigin: undefined,
    sourceRef:    undefined,
    sourcePath:   undefined,
    sourceDirty:  undefined,
  })
  assert(!source1.canFetch)
  assert(!source1.canCompile)
  source1.sourceOrigin = 'foo'
  assert(source1.canFetch)
  assert(source1.canCompile)
  source1.sourceOrigin = undefined
  source1.sourcePath = 'foo'
  assert(!source1.canFetch)
  assert(source1.canCompile)

  rejects(()=>new ContractCode({ source: source1 }).compile())

  assert(
    await new ContractCode({ source: source1, compiler: new Stub.Compiler() }).compile()
    instanceof CompiledCode
  )

  const rustSource1 = new RustSourceCode()
  assert(rustSource1[Symbol.toStringTag])
  deepEqual(rustSource1.serialize(), {
    sourceOrigin:   undefined,
    sourceRef:      undefined,
    sourcePath:     undefined,
    sourceDirty:    undefined,
    cargoToml:      undefined,
    cargoWorkspace: undefined,
    cargoCrate:     undefined,
    cargoFeatures:  undefined,
  })
  assert(!rustSource1.canFetch)
  assert(!rustSource1.canCompile)
  rustSource1.sourceOrigin = 'foo'
  assert(rustSource1.canFetch)
  assert(!rustSource1.canCompile)
  rustSource1.sourceOrigin = undefined
  rustSource1.sourcePath = 'foo'
  assert(!rustSource1.canFetch)
  assert(!rustSource1.canCompile)
  rustSource1.cargoToml = 'foo'
  assert(rustSource1.canCompile)
  rustSource1.canFetch
  rustSource1.canCompileInfo

  const compiled1 = new CompiledCode()
  deepEqual(compiled1.serialize(), {
    codeHash: undefined,
    codePath: undefined,
  })

  const uploaded1 = new UploadedCode()
  deepEqual(uploaded1.serialize(), {
    codeHash:  undefined,
    chainId:   undefined,
    codeId:    undefined,
    uploadBy:  undefined,
    uploadTx:  undefined,
    uploadGas: undefined
  })
}
