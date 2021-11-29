import { ChainNode, DockerizedChainNode, ChainNodeOptions } from '@fadroma/ops'
import { Path, Directory, TextFile, JSONFile, JSONDirectory, defaultStateBase, resolve,
         dirname, fileURLToPath } from '@fadroma/tools'

const __dirname = dirname(fileURLToPath(import.meta.url))

type ScrtNodeConstructor = new (options?: ChainNodeOptions) => ChainNode

export abstract class DockerizedScrtNode extends DockerizedChainNode {

  abstract readonly chainId: string
  abstract readonly image:   string

  readonly initScript = new TextFile(__dirname, 'ScrtChainNodeInit.sh')

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the SGX component. */
  readonly sgxDir: Directory

  protected setDirectories (stateRoot?: Path) {
    stateRoot = stateRoot || resolve(defaultStateBase, this.chainId)
    Object.assign(this, { stateRoot: new Directory(stateRoot) })
    Object.assign(this, {
      identities: this.stateRoot.subdir('identities', JSONDirectory),
      nodeState:  new JSONFile(stateRoot, 'node.json'),
      daemonDir:  this.stateRoot.subdir('_secretd'),
      clientDir:  this.stateRoot.subdir('_secretcli'),
      sgxDir:     this.stateRoot.subdir('_sgx-secrets')
    })
  }

  async spawn () {
    try {
      this.sgxDir.make()
    } catch (e) {
      console.warn(`Failed to create ${this.sgxDir.path}: ${e.message}`)
    }
    return await super.spawn()
  }

  get binds () {
    return {
      ...super.binds,
      [this.sgxDir.path]:    '/root/.sgx-secrets:rw',
      [this.daemonDir.path]: `/root/.secretd:rw`,
      [this.clientDir.path]: `/root/.secretcli:rw`,
    }
  }
}

export function resetLocalnet ({ chain }: any) {
  return chain.node.terminate()
}
