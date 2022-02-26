import {
  dirname, fileURLToPath, resolve,
  Fees, Gas,
  ChainNodeOptions, ChainNode,
  DockerChainNode, Path, Directory, TextFile, JSONFile, JSONDirectory,
  DockerBuilder,
  Client
} from '@fadroma/ops'

import type { SigningCosmWasmClient } from 'secretjs'

export type APIConstructor =
  new(...args:any) => SigningCosmWasmClient

export type ScrtNodeConstructor =
  new (options?: ChainNodeOptions) => ChainNode

export const __dirname = dirname(fileURLToPath(import.meta.url))

export const buildScript = resolve(__dirname, 'ScrtBuild.sh')

export class ScrtGas extends Gas {
  static denom = 'uscrt'
  static defaultFees: Fees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}

export abstract class DockerScrtNode extends DockerChainNode {
  abstract readonly chainId:    string
  abstract readonly image:      string
  abstract readonly initScript: TextFile
  protected setDirectories (stateRoot?: Path) {
    if (!this.chainId) {
      throw new Error('@fadroma/scrt: refusing to create directories for localnet with empty chain id')
    }
    stateRoot = stateRoot || resolve(process.cwd(), 'receipts', this.chainId)
    Object.assign(this, { stateRoot: new Directory(stateRoot) })
    Object.assign(this, {
      identities: this.stateRoot.subdir('identities', JSONDirectory),
      nodeState:  new JSONFile(stateRoot, 'node.json'),
    })
  }
}

export class ScrtDockerBuilder extends DockerBuilder {
  buildImage      = null
  buildDockerfile = null
  buildScript     = buildScript
}

export type UnsignedTX = {
  chain_id:       string
  account_number: string
  sequence:       string
  fee:            string
  msgs:           string
  memo:           string
}
