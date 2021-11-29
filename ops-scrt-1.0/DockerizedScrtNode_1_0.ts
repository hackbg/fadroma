import { ChainNodeOptions } from '@fadroma/ops'
import { DockerizedScrtNode } from '@fadroma/scrt/ScrtChainNode.ts'

export default class DockerizedScrtNode_1_0 extends DockerizedScrtNode {
  readonly chainId: string = 'enigma-pub-testnet-3'
  readonly image:   string = "enigmampc/secret-network-sw-dev"
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}
