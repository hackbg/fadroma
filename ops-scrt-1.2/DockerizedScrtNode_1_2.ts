import { ChainNodeOptions } from '@fadroma/ops'
import { DockerizedScrtNode } from '@fadroma/scrt/ScrtChainNode.ts'

export default class DockerizedScrtNode_1_2 extends DockerizedScrtNode {
  readonly chainId: string = 'secret-testnet-1'
  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.2.0"
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}
