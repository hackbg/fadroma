import type {
  CodeHash, ChainId, CodeId, TxHash, Address,
  SourceCode, RustSourceCode, CompiledCode, UploadedCode
} from '../API'

export function serializeSourceCode (code: SourceCode): {
  sourceOrigin?: string
  sourceRef?:    string
  sourcePath?:   string
  sourceDirty?:  boolean
  [key: string]: unknown
} {
  const { sourcePath, sourceOrigin, sourceRef, sourceDirty } = code
  return { sourcePath, sourceOrigin: sourceOrigin?.toString(), sourceRef, sourceDirty }
}

export function serializeRustSourceCode (code: RustSourceCode): ReturnType<typeof serializeSourceCode> & {
  cargoWorkspace?: string
  cargoCrate?:     string
  cargoFeatures?:  string[]
  [key: string]:   unknown
} {
  const { cargoToml, cargoWorkspace, cargoCrate, cargoFeatures } = code
  return {
    ...serializeSourceCode(code),
    cargoToml,
    cargoWorkspace,
    cargoCrate,
    cargoFeatures: cargoFeatures ? [...cargoFeatures] : undefined
  }
}

export function serializeCompiledCode (code: CompiledCode): {
  codeHash?: CodeHash
  codePath?: string
  [key: string]: unknown
} {
  const { codeHash, codePath } = code
  return { codeHash, codePath: codePath?.toString() }
}

export function serializeUploadedCode (code: UploadedCode): {
  codeHash?:     CodeHash
  chainId?:      ChainId
  codeId?:       CodeId
  uploadTx?:     TxHash
  uploadBy?:     Address
  uploadGas?:    string|number
  uploadInfo?:   string
  [key: string]: unknown
} {
  let { codeHash, chainId, codeId, uploadTx, uploadBy, uploadGas } = code
  if ((typeof code.uploadBy === 'object')) {
    uploadBy = (uploadBy as any).identity?.address
  }
  return { codeHash, chainId, codeId, uploadTx, uploadBy: uploadBy as string, uploadGas }
}
