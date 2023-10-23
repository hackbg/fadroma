/**

  Fadroma Deploy Store
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import type {
  AnyContract, Uploadable, Uploaded, ChainId, CodeHash, CodeId, DeploymentState
} from './fadroma'

import {
  Contract, Template, toUploadReceipt, DeployStore, Deployment, toInstanceReceipt, timestamp,
  Error as BaseError, Console, bold
} from '@fadroma/connect'

import $, {
  Path, OpaqueDirectory, TextFile, JSONDirectory, JSONFile, YAMLDirectory, YAMLFile, alignYAML
} from '@hackbg/file'

import YAML, { loadAll, dump } from 'js-yaml'

import { basename } from 'node:path'

/** Directory containing deploy receipts, e.g. `state/$CHAIN/deploy`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class DeployStore_v1 extends DeployStore {
  log = new DeployConsole('DeployStore_v1')
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
    this.log.label = `${this.root.shortPath}`
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
    if (!this.root.exists()) {
      this.log('creating', this.root.shortPath)
      this.root.make()
    }
    this.log.creating(name)
    const path = this.root.at(`${name}.yml`)
    if (path.exists()) throw new DeployError.DeploymentAlreadyExists(name)
    this.log.location(path.shortPath)
    path.makeParent().as(YAMLFile).save('')
    return this.load(name)
  }
  /** Make the specified deployment be the active deployment. */
  async select (name: string|null = this.activeName): Promise<DeploymentState> {
    if (!name) throw new DeployError('no deployment selected')
    let selected = this.root.at(`${name}.yml`)
    if (selected.exists()) {
      this.log.activating(selected.real.name)
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
      return list
        .filter(x=>x.endsWith('.yml'))
        .map(x=>basename(x, '.yml'))
        .filter(x=>x!=this.KEY)
    } else {
      this.log.storeDoesNotExist(this.root.shortPath)
      return []
    }
  }
  /** Get the contents of the named deployment, or null if it doesn't exist. */
  load (name: string|null|undefined = this.activeName): DeploymentState {
    if (!name) throw new DeployError('pass deployment name')
    const file = this.root.at(`${name}.yml`)
    this.log.log('loading', name)
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
      if (!name) throw new DeployError('Deployment: no name')
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

Object.assign(DeployStore.variants, { v1: DeployStore_v1 })

export class DeployConsole extends Console {
  creating = (name: string) =>
    this.log('creating', bold(name))
  location = (path: string) =>
    this.log('location', bold(path))
  activating = (name: string) =>
    this.log('activate', bold(name))
  list = (chainId: string, deployments: DeployStore) => {
    const list = deployments.list()
    if (list.length > 0) {
      this.info(`deployments on ${bold(chainId)}:`)
      let maxLength = 0
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        maxLength = Math.max(name.length, maxLength)
      }
      for (let name of list) {
        if (name === (deployments as any).KEY) continue
        const deployment = deployments.load(name)!
        const count = Object.keys(deployment.state).length
        let info = `${bold(name.padEnd(maxLength))}`
        info = `${info} (${deployment.size} contracts)`
        if (deployments.activeName === name) info = `${info} ${bold('selected')}`
        this.info(` `, info)
      }
    } else {
      this.info(`no deployments on ${bold(chainId)}`)
    }
  }

  storeDoesNotExist = (path: string) =>
    this.warn(`deployment store does not exist`)
}

export class DeployError extends BaseError {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists', (name: string)=>
    `deployment "${name}" already exists`)
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist', (name: string)=>
    `deployment "${name}" does not exist`)
}
