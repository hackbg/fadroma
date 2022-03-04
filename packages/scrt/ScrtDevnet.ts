import { DockerodeDevnet, ManagedDevnet } from '@fadroma/ops'

/** No extensions, just a type constraint. */
export abstract class DockerodeScrtDevnet extends DockerodeDevnet {
  constructor (options) { super(options) }
}

/** No extensions, just a type constraint. */
export abstract class ManagedScrtDevnet extends ManagedDevnet {
  constructor (options) { super(options) }
}
