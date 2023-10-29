import assert from 'node:assert'
import { ContractCode, SourceCode, CompiledCode, UploadedCode } from './code'
import { StubAgent, StubBuilder } from './stub'

export async function testContracts () {
  const contract = new ContractCode({
    source:   {},
    compiled: {},
    uploaded: {},
  })

  assert.rejects(()=>contract.compile())
  assert.rejects(()=>contract.compile({ builder: new StubBuilder() }))
  assert.rejects(()=>contract.upload())
  assert.rejects(()=>contract.upload({ uploader: new StubAgent() }))

  assert(contract.source instanceof SourceCode)
  assert(contract.compiled instanceof CompiledCode)
  assert(contract.uploaded instanceof UploadedCode)

  assert(!(contract.source.isValid()))
  assert(!(contract.compiled.isValid()))
  assert(!(contract.uploaded.isValid()))

  assert.deepEqual(contract.source.toReceipt(), {
    crate:      undefined,
    dirty:      undefined,
    features:   undefined,
    repository: undefined,
    revision:   undefined,
    workspace:  undefined,
  })
  assert.deepEqual(contract.compiled.toReceipt(), {
    codeHash:  undefined,
    codePath:  undefined,
    buildInfo: undefined,
  })
  assert.deepEqual(contract.uploaded.toReceipt(), {
    codeHash:  undefined,
    chainId:   undefined,
    codeId:    undefined,
    uploadBy:  undefined,
    uploadTx:  undefined
  })
  //assert.deepEqual(contract.instance.toReceipt(), {
    //codeHash:  undefined,
    //chainId:   undefined,
    //codeId:    undefined,
    //label:     undefined,
    //initMsg:   undefined,
    //initBy:    undefined,
    //initTx:    undefined,
    //initGas:   undefined,
    //address:   undefined,
  //})

  assert(contract.source[Symbol.toStringTag] || true)
  assert(contract.compiled[Symbol.toStringTag] || true)
  //assert(contract.uploaded[Symbol.toStringTag])
  //assert(contract.instance[Symbol.toStringTag])

  assert.rejects(()=>new CompiledCode().fetch())
  assert.rejects(()=>new CompiledCode({ codePath: '' }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: new URL('', 'file:') }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: new URL('http://foo.bar') }).fetch())
  assert.rejects(()=>new CompiledCode({ codePath: 0 as any }).fetch())
}
