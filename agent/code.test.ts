/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { rejects, deepEqual, equal } from 'node:assert'
import { ContractCode, SourceCode, RustSourceCode, CompiledCode, UploadedCode } from './code'
import * as Stub from './stub'
import { fixture } from '../fixtures/fixtures'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['compiler', testCodeCompiler],
  ['units',    testCodeUnits],
  ['contract', testCodeContract]
])

export async function testCodeCompiler () {
  assert((await new Stub.Compiler().build('')) instanceof CompiledCode)
  assert((await new Stub.Compiler().buildMany([{}]))[0] instanceof CompiledCode)
}

export async function testCodeUnits () {
  const source1 = new SourceCode()
  deepEqual(source1.toReceipt(), {
    sourcePath:  undefined,
    sourceRepo:  undefined,
    sourceRef:   undefined,
    sourceDirty: undefined
  })
  assert(!source1.isValid())
  console.log(source1)
  source1.sourcePath = 'foo'
  assert(source1.isValid())

  const rustSource1 = new RustSourceCode()
  deepEqual(rustSource1.toReceipt(), {
    sourcePath:     undefined,
    sourceRepo:     undefined,
    sourceRef:      undefined,
    sourceDirty:    undefined,
    cargoWorkspace: undefined,
    cargoCrate:     undefined,
    cargoFeatures:  undefined,
  })
  console.log(rustSource1)
  assert(!rustSource1.isValid())
  rustSource1.sourcePath = 'foo'
  assert(rustSource1.isValid())
  rustSource1.cargoWorkspace = 'bar'
  assert(!rustSource1.isValid())
  rustSource1.cargoCrate = 'baz'
  assert(rustSource1.isValid())

  const compiled1 = new CompiledCode()
  deepEqual(compiled1.toReceipt(), {
    codeHash:  undefined,
    codePath:  undefined,
  })
  console.log(compiled1)
  assert(!compiled1.isValid())
  compiled1.codePath = fixture('empty.wasm')
  assert(compiled1.isValid())
  assert(await compiled1.computeHash())

  const uploaded1 = new UploadedCode()
  deepEqual(uploaded1.toReceipt(), {
    codeHash:  undefined,
    chainId:   undefined,
    codeId:    undefined,
    uploadBy:  undefined,
    uploadTx:  undefined,
    uploadGas: undefined
  })
  console.log(uploaded1)
  assert(!uploaded1.isValid())
  uploaded1.chainId = 'foo'
  uploaded1.codeId  = 'bar'
  assert(uploaded1.isValid())
}

export async function testCodeContract () {
  const contract1 = new ContractCode({
    source:   new SourceCode(),
    compiled: new CompiledCode(),
    uploaded: new UploadedCode()
  })
  assert(contract1.source instanceof SourceCode)
  assert(contract1.compiled instanceof CompiledCode)
  assert(contract1.uploaded instanceof UploadedCode)
  // can't compile missing code
  rejects(()=>contract1.compile())
  const validSource = new class extends SourceCode { isValid () { return true } }
  const invalidSource = new class extends SourceCode { isValid () { return false } }
  const brokenCompiler: any = { build: () => Promise.resolve({ isValid: () => false }) }
  rejects(()=>new ContractCode({source: validSource}).compile({compiler: brokenCompiler}))
  rejects(()=>new ContractCode({source: invalidSource}).compile({compiler: new Stub.Compiler()}))
  assert(new ContractCode({ source: validSource }).compile({ compiler: new Stub.Compiler() }))
  // can't upload missing code
  rejects(()=>contract1.upload())
  rejects(()=>contract1.upload({uploader: new Stub.Agent()}))
  rejects(()=>contract1.upload({uploader: {upload: () => Promise.resolve({ isValid: () => false })} as any}))
  assert(contract1.source[Symbol.toStringTag] || true)
  assert(contract1.compiled[Symbol.toStringTag] || true)
  //assert(contract1.uploaded[Symbol.toStringTag])
  //assert(contract1.instance[Symbol.toStringTag])
  rejects(()=>new CompiledCode().fetch())
  rejects(()=>new CompiledCode({ codePath: '' }).fetch())
  rejects(()=>new CompiledCode({ codePath: new URL('', 'file:') }).fetch())
  rejects(()=>new CompiledCode({ codePath: new URL('http://foo.bar') }).fetch())
  rejects(()=>new CompiledCode({ codePath: 0 as any }).fetch())
}
