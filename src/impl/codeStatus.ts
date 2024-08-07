import type { SourceCode, RustSourceCode, CompiledCode, UploadedCode } from '../API'

export function sourceCodeStatus (code: SourceCode) {
  const canFetch       = !!code.sourceOrigin
  const canFetchInfo   = (!code.sourceOrigin) ? "missing sourceOrigin" : undefined
  const canCompile     = !!code.sourcePath || canFetch
  const canCompileInfo = (!code.sourcePath) ? "missing sourcePath" : undefined
  return { canFetch, canFetchInfo, canCompile, canCompileInfo }
}

export function rustSourceCodeStatus (code: RustSourceCode) {
  const status = sourceCodeStatus(code)

  const { canFetch, canFetchInfo } = status
  const hasWorkspace = !!code.cargoWorkspace
  const hasCrateToml = !!code.cargoToml
  const hasCrateName = !!code.cargoCrate
  const canCompile = (
    ( hasWorkspace && !hasCrateToml &&  hasCrateName) ||
    (!hasWorkspace &&  hasCrateToml && !hasCrateName)
  )

  let { canCompileInfo } = status
  let error
  if (hasWorkspace) {
    if (hasCrateToml) {
      error = "cargoWorkspace is set, cargoToml must be unset"
    }
    if (!hasCrateName) {
      error = "when cargoWorkspace is set, cargoCrate must also be set"
    }
  } else if (hasCrateToml) {
    if (hasCrateName) {
      error = "when cargoToml is set, cargoCrate must be unset"
    }
  } else {
    error = "set either cargoToml or cargoWorkspace & cargoCrate"
  }
  if (canCompileInfo || error) {
    canCompileInfo = [canCompileInfo, error].filter(Boolean).join('; ')
  }

  return {
    canFetch,
    canFetchInfo,
    canCompile,
    canCompileInfo
  }
}

export function compiledCodeStatus (code: CompiledCode) {
  const canFetch      = !!code.codePath
  const canFetchInfo  = (!code.codePath) ? "can't fetch binary: codePath is not set" : ''
  const canUpload     = !!code.codeData || canFetch
  let canUploadInfo = ''
  if (!code.codeData && canFetch) {
    canUploadInfo = "uploading will fetch the binary from the specified path"
  }
  if (code.codeData && !code.codePath) {
    canUploadInfo = "uploading from buffer, codePath is unspecified"
  }
  return {
    canFetch,
    canFetchInfo,
    canUpload,
    canUploadInfo
  }
}

export function uploadedCodeStatus (code: UploadedCode) {
  return {
    canInstantiate: !!(code.chainId && code.codeId),
    canInstantiateInfo: (
      (!code.chainId) ? "can't instantiate: no chain id" :
      (!code.codeId)  ? "can't instantiate: no code id"  :
      undefined
    )
  }
}
