/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { ContractCode, SourceCode, CompiledCode, UploadedCode } from './code'
import * as Stub from './stub'

export default async function testContracts () {
  const contract1 = new ContractCode({
    source: {}, compiler: {} as any, compiled: {}, uploader: {} as any, uploaded: {},
  })

  const contract2 = new ContractCode({
    source: {}, compiled: {}, uploaded: {},
  })

  assert(contract2.source instanceof SourceCode)
  assert(contract2.compiled instanceof CompiledCode)
  assert(contract2.uploaded instanceof UploadedCode)

  assert(!(contract2.source.isValid()))
  assert(!(contract2.compiled.isValid()))
  assert(!(contract2.uploaded.isValid()))

  // can't compile missing code
  assert.rejects(()=>contract2.compile())
  const validSource = new class extends SourceCode { isValid () { return true } }
  const invalidSource = new class extends SourceCode { isValid () { return false } }
  const brokenCompiler = { build: () => Promise.resolve({ isValid: () => false }) }
  assert.rejects(
    ()=>new ContractCode({ source: validSource }).compile({ compiler: brokenCompiler as any })
  )
  assert.rejects(
    ()=>new ContractCode({ source: invalidSource }).compile({ compiler: new Stub.Compiler() })
  )
  assert.ok(
    new ContractCode({ source: validSource }).compile({ compiler: new Stub.Compiler() })
  )

  // can't upload missing code
  assert.rejects(
    ()=>contract2.upload()
  )
  assert.rejects(()=>contract2.upload({
    uploader: new Stub.Agent()
  }))
  assert.rejects(()=>contract2.upload({
    uploader: { upload: () => Promise.resolve({ isValid: () => false }) } as any
  }))

  assert.deepEqual(contract2.source.toReceipt(), {
    crate:      undefined,
    dirty:      undefined,
    features:   undefined,
    repository: undefined,
    revision:   undefined,
    workspace:  undefined,
  })
  assert.deepEqual(contract2.compiled.toReceipt(), {
    codeHash:  undefined,
    codePath:  undefined,
    buildInfo: undefined,
  })
  assert.deepEqual(contract2.uploaded.toReceipt(), {
    codeHash:  undefined,
    chainId:   undefined,
    codeId:    undefined,
    uploadBy:  undefined,
    uploadTx:  undefined
  })

  assert(contract2.source[Symbol.toStringTag] || true)
  assert(contract2.compiled[Symbol.toStringTag] || true)
  //assert(contract2.uploaded[Symbol.toStringTag])
  //assert(contract2.instance[Symbol.toStringTag])

  assert.rejects(()=>new CompiledCode().fetch())

  assert.rejects(()=>new CompiledCode({
    codePath: ''
  }).fetch())

  assert.rejects(()=>new CompiledCode({
    codePath: new URL('', 'file:')
  }).fetch())

  assert.rejects(()=>new CompiledCode({
    codePath: new URL('http://foo.bar')
  }).fetch())

  assert.rejects(()=>new CompiledCode({
    codePath: 0 as any
  }).fetch())

}
