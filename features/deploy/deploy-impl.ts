import type { Address, Agent, Compiler, CompiledCode, CodeHash } from '@hackbg/fadroma'
import type { DeploymentUnit } from './DeploymentUnit'

export async function compile (unit: DeploymentUnit, {
  compiler = unit.compiler,
  rebuild  = false,
  ...buildOptions
}: {
  compiler?: Compiler
  rebuild?: boolean
} = {}): Promise<CompiledCode & Parameters<Compiler["build"]>[1] & {
  codeHash: CodeHash
}> {
  if (unit.compiled?.status().canUpload && !rebuild) {
    return Promise.resolve(
      unit.compiled as typeof unit["compiled"] & { codeHash: CodeHash }
    )
  }
  if (!compiler) {
    throw new Error("can't compile: no compiler")
  }
  if (!unit.source) {
    throw new Error(`can't compile: no source`)
  }
  if (!unit.source.status().canCompile) {
    throw new Error(`can't compile: ${unit.source.status().canCompileInfo??'unspecified reason'}`)
  }
  const compiled = await compiler.build(unit.source, buildOptions)
  if (!compiled.status().canUpload) {
    throw new Error("build failed")
  }
  return unit.compiled = compiled as typeof compiled & { codeHash: CodeHash }
}

export async function upload (unit: DeploymentUnit, {
  compiler = unit.compiler,
  rebuild  = false,
  uploader = unit.uploader,
  reupload = rebuild,
  ...uploadOptions
}: Parameters<typeof compile>[0] & Parameters<Agent["upload"]>[1] & {
  uploader?: Address|{ upload: Agent["upload"] }
  reupload?: boolean,
} = {}): Promise<UploadedCode & {
  codeId: CodeId
}> {
  if (unit.uploaded?.canInstantiate && !reupload && !rebuild) {
    return unit.uploaded as typeof uploaded & { codeId: CodeId }
  }
  if (!uploader || (typeof uploader === 'string')) {
    throw new Error("can't upload: no uploader agent")
  }
  const compiled = await unit.compile({ compiler, rebuild })
  const uploaded = await uploader.upload(compiled, uploadOptions)
  if (!uploaded.canInstantiate) {
    throw new Error("upload failed")
  }
  return unit.uploaded = uploaded
}

export async function instantiate (unit: DeploymentUnit, {
  deployer = unit.deployer,
  redeploy = false,
  uploader = unit.uploader||deployer,
  reupload = false,
  compiler = unit.compiler,
  rebuild  = false,
  ...initOptions
}: Parameters<typeof upload>[0] & Parameters<Agent["instantiate"]>[0] & {
  deployer?: Address|{ instantiate: Agent["instantiate"] }
  redeploy?: boolean
} = {}): Promise<ContractInstance & {
  address: Address
}> {
  if (unit.isValid() && !redeploy && !reupload && !rebuild) {
    return unit
  }
  if (!deployer || (typeof deployer === 'string')) {
    throw new Error("can't deploy: no deployer agent")
  }
  const uploaded = await unit.upload({
    compiler, rebuild, uploader, reupload
  })
  const instance = await deployer.instantiate(uploaded, unit)
  if (!instance.isValid()) {
    throw new Error("init failed")
  }
  return instance
}
