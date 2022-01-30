import {
  DockerizedScrtNode, ChainNodeOptions,
  TextFile, dirname, fileURLToPath
} from '@fadroma/scrt'

const __dirname = dirname(fileURLToPath(import.meta.url))

export class DockerizedScrtNode_1_0 extends DockerizedScrtNode {

  readonly chainId: string = 'enigma-pub-testnet-3'

  readonly image:   string = "enigmampc/secret-network-sw-dev:v1.0.4-5"

  readonly readyPhrase = 'GENESIS COMPLETE'

  readonly initScript = new TextFile(__dirname, 'init.sh')

  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }

}
