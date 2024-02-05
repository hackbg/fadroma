export * from './program.browser'

import { Console, bold } from './core'
import { CompiledCode } from './program.browser'

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** An object representing a given compiled binary on the local filesystem. */
export class LocalCompiledCode extends CompiledCode {

  protected async doFetch () {
    if (typeof this.codePath === 'string') {
      return await readFile(this.codePath)
    } else if (this.codePath instanceof URL) {
      if (this.codePath.protocol === 'file:') {
        return await readFile(fileURLToPath(this.codePath))
      } else {
        return super.doFetch()
      }
    } else {
      throw new Error("can't fetch: invalid codePath")
    }
  }

}

