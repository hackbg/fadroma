import type { SourceCode, RustSourceCode, CompiledCode, UploadedCode } from '../API'

export function sourceCodeStringTag (code: SourceCode) {
  return [
    code.sourcePath ? code.sourcePath : `(missing source)`,
    code.sourceOrigin && `(from ${code.sourceOrigin})`,
    code.sourceRef    && `(at ${code.sourceRef})`,
    code.sourceDirty  && `(modified)`
  ].filter(Boolean).join(' ')
}

export function rustSourceCodeStringTag (code: RustSourceCode) {
  return [
    code.cargoWorkspace
      ? ((code.cargoCrate ? `crate ${code.cargoCrate} from` : 'unknown crate from')
         +code.cargoWorkspace)
      : code.cargoToml,
    sourceCodeStringTag(code),
  ].filter(Boolean).join(' ')
}

export function compiledCodeStringTag (code: CompiledCode) {
  return [
    code.codePath && `${code.codePath}`,
    code.codeHash && `${code.codeHash}`,
    code.codeData && `(${code.codeData.length} bytes)`
  ].filter(Boolean).join(' ')
}

export function uploadedCodeStringTag (code: UploadedCode) {
  return [
    code.codeId   || 'no code id',
    code.chainId  || 'no chain id',
    code.codeHash || '(no code hash)'
  ].join('; ')
}
