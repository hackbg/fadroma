import { Console, Error } from './agent-base'
import type { Class, CodeHash, Name } from './agent-base'
import type { ChainId } from './agent-chain'
import { Deployment, ContractTemplate, CompiledCode } from './agent-contract'
import type { DeploymentClass, DeploymentState } from './agent-contract'

export abstract class Builder {

  static variants: Record<string, Class<Builder, any>> = {}

  log = new Console(this.constructor.name)

  /** Whether to enable build caching.
    * When set to false, this builder will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true

  /** Unique identifier of this builder implementation. */
  abstract id: string

  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (
    buildable: string|Partial<CompiledCode>,
    ...args: any[]
  ): Promise<CompiledCode>

  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  abstract buildMany (
    sources: (string|Partial<CompiledCode>)[],
    ...args: unknown[]
  ): Promise<CompiledCode[]>
}

export class StubBuilder extends Builder {
  caching = false

  id = 'stub'

  async build (
    source: string|Partial<CompiledCode>,
    ...args: any[]
  ): Promise<CompiledCode> {
    if (typeof source === 'string') {
      source = new CompiledCode({ repository: source })
    } else {
      source = new CompiledCode(source)
    }
    return source as CompiledCode
  }

  async buildMany (
    sources: (string|Partial<CompiledCode>)[],
    ...args: unknown[]
  ): Promise<CompiledCode[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export class UploadStore extends Map<CodeHash, ContractTemplate> {
  log = new Console('UploadStore')

  constructor () {
    super()
  }

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

  constructor () {
    super()
  }

  get (name: Name): Deployment|undefined {
    return super.get(name)
  }

  set (name: Name, deployment: Partial<Deployment>): this {
    if (!(deployment instanceof Deployment)) deployment = new Deployment(deployment)
    return super.set(name, deployment as Deployment)
  }
}
