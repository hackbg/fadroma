import type { Message } from './Core'
import { Agent } from './Agent'
import { Chain } from './Chain'
import { Deployment, Deployments } from './Deploy'
import { BaseUploader } from './Upload'

import {
  Console, bold,
  resolve, relative, basename,
  existsSync, readFile, writeFile, mkdir,
  homedir, tmp, copy,
  Docker, ensureDockerImage,
  rimraf, spawnSync,
  backOff
} from '@hackbg/tools'

const console = Console('@fadroma/ops/Contract')

import type { Source, Builder, Artifact, Uploader, Template, Instance } from './Core'

import { Client, ClientConstructor } from './Client'

export interface ContractInfo {
  source?:   Source
  artifact?: Artifact
  template?: Template
  instance?: Instance
}

export type ContractInit = [Contract<any>, any?, string?, string?]

export abstract class Contract<C extends Client> {

  static fromSource (path: string, crate?: string) {
    throw new Error('not implemented')
  }
  static fromWASM (path: string, expectedCodeHash?: string) {
    throw new Error('not implemented')
  }
  static fromCodeId (chainId: string, expectedCodeHash?: string) {
    throw new Error('not implemented')
  }
  static fromAddress (chainId: string, address: string, expectedCodeHash?: string) {
    throw new Error('not implemented')
  }

  constructor (options: ContractInfo = {}) {
    Object.assign(this, options)
  }

  source:   Source   | null

  Builder: new <B extends Builder> () => Builder
  builder: Builder | null
  async build (builder: Builder = new this.Builder()) {
    this.builder = builder
    return this.artifact = await this.builder.build(this.source)
  }

  artifact: Artifact | null

  Uploader: new <U extends Uploader> (agent: Agent) => Uploader
  uploader: Uploader | null
  async upload (by: Agent|Uploader) {
    if (by instanceof Agent) by = new this.Uploader(by)
    this.uploader = by as Uploader
    return this.template = await this.uploader.upload(this.artifact)
  }

  template: Template | null
  get chainId () {
    return this.instance?.chainId||this.template?.chainId
  }
  get codeId () {
    return this.instance?.codeId||this.template?.codeId
  }

  instance: Instance | null

  initMsg?: any

  abstract name: string

  get address () { return this.instance?.address }
  set address (v: string) {
    if (this.instance) {
      this.instance.address = v
    } else {
      const { codeId, codeHash, label, chainId } = this
      this.instance = { chainId, codeId, codeHash, address: v, label }
    }
  }
  get codeHash () {
    return this.instance?.codeHash||this.template?.codeHash||this.artifact?.codeHash
  }

  prefix?: string
  suffix?: string
  get label (): string {
    if (!this.name) {
      throw new Error(
        '[@fadroma/contract] Tried to get label of contract with missing name.'
      )
    }
    const { prefix, name, suffix } = this
    let label = ''
    if (prefix) { label += `${prefix}/` }
    if (name)   { label += name } else { label += 'UNTITLED' }
    if (suffix) { label += suffix }
    return label
  }

  Client: ClientConstructor<C>
  client (agent: Agent): C {
    return new this.Client({ ...(this.instance||{}), agent })
  }

}
