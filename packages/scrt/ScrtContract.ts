import { ContractAPI } from '@fadroma/ops'

export class ScrtContract extends ContractAPI {
  get buildImage (): string {
    throw new Error(SHOULD_SPECIFY_VERSION)
  }
  get buildScript (): string {
    throw new Error(SHOULD_SPECIFY_VERSION)
  }
}

export const SHOULD_SPECIFY_VERSION = `
  The build procedure differs between Secret Network 1.0 and 1.2.

  To enable building of contracts, inherit from either:
    - ScrtContract_1_0 in @fadroma/scrt-1.0
    - ScrtContract_1_2 in @fadroma/scrt-1.2
  depending on the version you're targeting.

  In most cases, you want the second option.
`
