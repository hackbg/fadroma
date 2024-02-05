import { Console } from './core'
import type { CodeHash } from './program.browser'
import type { Name, DeploymentState } from './deploy'
import { Deployment, UploadedCode } from './deploy'

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export class DeployStore extends Map<Name, DeploymentState> {
  log = new Console(this.constructor.name)

  constructor () {
    super()
  }

  selected?: DeploymentState = undefined

  get (name?: Name): DeploymentState|undefined {
    if (arguments.length === 0) {
      return this.selected
    }
    return super.get(name!)
  }

  set (name: Name, state: Partial<Deployment>|DeploymentState): this {
    if (state instanceof Deployment) state = state.serialize()
    return super.set(name, state)
  }
}

export class UploadStore extends Map<CodeHash, UploadedCode> {
  log = new Console(this.constructor.name)

  constructor () {
    super()
  }

  get (codeHash: CodeHash): UploadedCode|undefined {
    return super.get(codeHash)
  }

  set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
    if (!(value instanceof UploadedCode)) {
      value = new UploadedCode(value)
    }
    if (value.codeHash && (value.codeHash !== codeHash)) {
      throw new Error('tried to store upload under different code hash')
    }
    return super.set(codeHash, value as UploadedCode)
  }
}
