import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { CompiledCode } from '../API'
import { fetchCompiledCode } from './fetchCompiledCode'

export async function fetchCompiledCodeLocal (code: CompiledCode) {

  if (typeof code.codePath === 'string') {
    return await readFile(code.codePath)
  }

  if (code.codePath instanceof URL) {
    if (code.codePath.protocol === 'file:') {
      return await readFile(fileURLToPath(code.codePath))
    } else {
      return fetchCompiledCode(code)
    }
  }

  throw new Error("can't fetch: invalid codePath")

}
