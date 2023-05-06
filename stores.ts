import $, { Path, OpaqueDirectory, TextFile, JSONDirectory, JSONFile, YAMLDirectory, YAMLFile, alignYAML } from '@hackbg/file'
import type { AnyContract, UploadStore, Uploadable, Uploaded, ChainId, CodeHash, CodeId, DeploymentState } from '@fadroma/agent'
import { Contract, Template, toUploadReceipt, DeployStore, Deployment, toInstanceReceipt, timestamp } from '@fadroma/agent'
import { Console, DeployError, bold } from './util'
import { basename } from 'node:path'
import YAML, { loadAll, dump } from 'js-yaml'

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class UploadStore_JSON1
extends JSONDirectory<UploadStore_JSON1_Receipt>
implements UploadStore {
  log = new Console('UploadStore (JSON, v1)')
  get (contract: Uploadable, _chainId?: ChainId): Uploaded|null {
    const name = this.getUploadReceiptName(contract)
    const receiptFile = this.at(name)
    if (!receiptFile.exists()) return null
    const receipt = receiptFile.as(UploadStore_JSON1_Receipt)
    this.log.sub(name).log(`Already uploaded, see`, bold(receiptFile.shortPath))
    const { chainId, codeId, codeHash, uploadTx, } = receipt.toTemplate(_chainId)
    const update = { chainId, codeId, codeHash, uploadTx }
    return Object.assign(contract, update) as Uploaded & {
      artifact: URL, codeHash: CodeHash, codeId:CodeId
    }
  }
  set (receipt: Uploaded) {
    const path = this.getUploadReceiptPath(receipt)
    $(path).as(UploadStore_JSON1_Receipt).save(toUploadReceipt(receipt))
  }
  /** Generate the filename for an upload receipt. */
  getUploadReceiptName ({ artifact }: Uploadable|Uploaded): string {
    return `${$(artifact!).name}.json`
  }
  /** Generate the full path for an upload receipt. */
  getUploadReceiptPath (contract: Uploadable|Uploaded): string {
    return this.resolve(`${this.getUploadReceiptName(contract)}`)
  }
}

/** Class that convert itself to a `Template`,
  * from which `Contract`s can subsequently be instantiated. */
export class UploadStore_JSON1_Receipt extends JSONFile<UploadReceiptData> {
  /** Create a Template object with the data from the receipt. */
  toTemplate (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Template({ artifact, codeHash, chainId, codeId, uploadTx })
  }
}

export interface UploadReceiptData {
  artifact?:          any
  chainId?:           string
  codeHash:           string
  codeId:             number|string
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
  uploadTx?:          string
}

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class DeployStore_YAML1 extends DeployStore {
  log = new Console('DeployStore (YAML, v1)')
  /** Root directory of deploy store. */
  root: YAMLDirectory<unknown>
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'

  constructor (
    storePath: string|Path|YAMLDirectory<unknown>,
    public defaults: Partial<Deployment> = {},
  ) {
    super()
    const root = this.root = $(storePath).as(YAMLDirectory)
    Object.defineProperty(this, 'root', {
      enumerable: true,
      get () { return root }
    })
  }

  get [Symbol.toStringTag]() {
    return `${this.root?.shortPath??'-'}`
  }
  /** @returns the name of the active deployment */
  get activeName (): string|null {
    let file = this.root.at(`${this.KEY}.yml`)
    if (!file.exists()) return null
    return basename(file.real.name, '.yml')
  }

  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()): Promise<DeploymentState> {
    this.log.trace('create', name)
    if (!this.root.exists()) {
      this.log('creating', this.root.shortPath)
      this.root.make()
    }
    this.log.deploy.creating(name)
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    this.log.deploy.location(path.shortPath)
    path.makeParent().as(YAMLFile).save('')
    return this.load(name)
  }
  /** Make the specified deployment be the active deployment. */
  async select (name: string|null = this.activeName): Promise<DeploymentState> {
    if (!name) throw new Error('No deployment is currently selected.')
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      this.log.deploy.activating(selected.real.name)
      const active = this.root.at(`${this.KEY}.yml`).as(YAMLFile)
      if (name === this.KEY) name = active.real.name
      name = basename(name, '.yml')
      active.relLink(`${name}.yml`)
      return this.load(name)!
    }
    throw new DeployError.DeploymentDoesNotExist(name)
  }
  /** List the deployments in the deployments directory. */
  list (): string[] {
    if (this.root.exists()) {
      const list = this.root.as(OpaqueDirectory).list() ?? []
      return list.filter(x=>x.endsWith('.yml')).map(x=>basename(x, '.yml')).filter(x=>x!=this.KEY)
    } else {
      this.log.deploy.warnStoreDoesNotExist(this.root.shortPath)
      return []
    }
  }
  /** Get the contents of the named deployment, or null if it doesn't exist. */
  load (name: string|null|undefined = this.activeName): DeploymentState {
    if (!name) throw new Error('Pass a deployment name.')
    const file = this.root.at(`${name}.yml`)
    this.log.log('Loading deployment', name, 'from', file.shortPath)
    name = basename(file.real.name, '.yml')
    const state: DeploymentState = {}
    for (const receipt of file.as(YAMLFile).loadAll() as Partial<AnyContract>[]) {
      if (!receipt.name) continue
      state[receipt.name] = receipt
    }
    return state
  }
  /** Save a deployment's state to this store. */
  save (name: string, state: DeploymentState = {}) {
    this.root.make()
    const file = this.root.at(`${name}.yml`)
    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(state)) {
      output += '---\n'
      name ??= data.name!
      if (!name) throw new Error('Deployment: no name')
      const receipt: any = toInstanceReceipt(new Contract(data as Partial<AnyContract>) as any)
      data = JSON.parse(JSON.stringify({
        name,
        label:    receipt.label,
        address:  receipt.address,
        codeHash: receipt.codeHash,
        codeId:   receipt.label,
        crate:    receipt.crate,
        revision: receipt.revision,
        ...receipt,
        deployment: undefined
      }))
      const daDump = dump(data, { noRefs: true })
      output += alignYAML(daDump)
    }
    file.as(TextFile).save(output)
    return this
  }

}

Object.assign(DeployStore.variants, { YAML1: DeployStore_YAML1 })
