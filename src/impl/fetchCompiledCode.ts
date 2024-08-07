import type { CompiledCode } from '../API'
import { Console } from '../util'

export async function fetchCompiledCode (code: CompiledCode) {

  const console = new Console(`CompiledCode(${bold(code[Symbol.toStringTag])})`)

  if (code.codeData) {
    console.debug("not fetching: codeData found; unset to refetch")
    return code.codeData
  }

  if (!code.codePath) {
    throw new Error("can't fetch: missing codePath")
  }

  code.codeData = await code.fetchImpl()

  if (code.codeHash) {
    const hash0 = String(code.codeHash).toLowerCase()
    const hash1 = CompiledCode.toCodeHash(code.codeData)
    if (hash0 !== hash1) {
      throw new Error(`code hash mismatch: expected ${hash0}, computed ${hash1}`)
    }
  } else {
    code.codeHash = CompiledCode.toCodeHash(code.codeData)
    console.warn(
      "\n  TOFU: Computed code hash from fetched data:" +
      `\n  ${bold(code.codeHash)}` +
      '\n  Pin the expected code hash by setting the codeHash property.')
  }

  return code.codeData

}

