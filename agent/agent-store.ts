import { Console, Error } from './agent-base'
import type { Class, CodeHash, Name } from './agent-base'
import type { ChainId } from './agent-chain'
import { Deployment, ContractTemplate } from './agent-contract'
import type { DeploymentClass, DeploymentState } from './agent-contract'

export class UploadStore extends Map<CodeHash, ContractTemplate> {
  log = new Console('UploadStore')

  get (codeHash: CodeHash): ContractTemplate|undefined {
    return super.get(codeHash)
  }

  set (codeHash: CodeHash, value: Partial<ContractTemplate>): this {
    if (!(value instanceof ContractTemplate)) value = new ContractTemplate(value)
    if (value.codeHash && (value.codeHash !== codeHash)) throw new Error.Invalid('code hash mismatch')
    return super.set(codeHash, value as ContractTemplate)
  }
}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export class DeployStore extends Map<Name, Deployment> {
  log = new Console('DeployStore')

  get (name: Name): Deployment|undefined {
    return super.get(name)
  }

  set (name: Name, deployment: Partial<Deployment>): this {
    if (!(deployment instanceof Deployment)) deployment = new Deployment(deployment)
    return super.set(name, deployment as Deployment)
  }
}
