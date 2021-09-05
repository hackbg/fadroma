import { DockerizedChainNode, ChainNodeOptions } from '@fadroma/ops'
import { TextFile, Directory, defaultStateBase, resolve, JSONDirectory, JSONFile } from '@fadroma/tools'

export class DockerizedScrtNode extends DockerizedChainNode {

  readonly chainId: string = 'enigma-pub-testnet-3'

  readonly image: string = "enigmampc/secret-network-sw-dev"

  readonly initScript = new TextFile(__dirname, 'scrt_localnet_init.sh')

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the SGX component. */
  readonly sgxDir: Directory

  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    const stateRoot = options.stateRoot || resolve(defaultStateBase, this.chainId)
    Object.assign(this, {stateRoot:  new Directory(stateRoot),
                         identities: new JSONDirectory(stateRoot, 'identities'),
                         nodeState:  new JSONFile(stateRoot,  'node.json'),
                         daemonDir:  new Directory(stateRoot, '_secretd'),
                         clientDir:  new Directory(stateRoot, '_secretcli'),
                         sgxDir:     new Directory(this.stateRoot.path, '_sgx-secrets')}) }

  async spawn () {
    this.sgxDir.make()
    return await super.spawn() }

  get binds () {
    return {
      ...super.binds,
      [this.sgxDir.path]:    '/root/.sgx-secrets:rw',
      [this.daemonDir.path]: `/root/.secretd:rw`,
      [this.clientDir.path]: `/root/.secretcli:rw`, } } }
