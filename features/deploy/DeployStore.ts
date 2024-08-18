import type { Name } from '@hackbg/fadroma'
import { Console } from '@hackbg/fadroma'
import type { DeploymentState } from './Deployment'
import { Deployment } from './Deployment'

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
    if (state instanceof Deployment) {
      state = state.serialize()
    }
    return super.set(name, state)
  }
}
