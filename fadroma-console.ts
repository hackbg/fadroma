/**

  Fadroma: Event Console
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

import type { Devnet, Template, Built, DeployStore } from './fadroma'

import { HEAD, bold, colors, Console as BaseConsole } from '@fadroma/connect'

import $ from '@hackbg/file'
import type { Path } from '@hackbg/file'

export { bold, colors }

export default class Console extends BaseConsole {

  constructor (public label = '@hackbg/fadroma') {
    super()
  }

  build = ((self: Console)=>({

    one: ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) => self.log(
      'Building', bold(crate), ...(revision === 'HEAD')
        ? ['from working tree']
        : ['from Git reference', bold(revision)]),
    many: (sources: Template<any>[]) =>
      sources.forEach(source=>self.build.one(source)),
    workspace: (mounted: Path|string, ref: string = HEAD) => self.log(
      `building from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)),
    container: (root: string|Path, revision: string, cratesToBuild: string[]) => {
      root = $(root).shortPath
      const crates = cratesToBuild.map(x=>bold(x)).join(', ')
      self.log(`started building from ${bold(root)} @ ${bold(revision)}:`, crates) },
    found: ({ artifact }: Built) =>
      self.log(`found at ${bold($(artifact!).shortPath)}`),

  }))(this)

  deploy = ((self: Console)=>({

    creating: (name: string) =>
      self.log('creating', bold(name)),
    location: (path: string) =>
      self.log('location', bold(path)),
    activating: (name: string) =>
      self.log('activate', bold(name)),
    list: (chainId: string, deployments: DeployStore) => {
      const list = deployments.list()
      if (list.length > 0) {
        self.info(`deployments on ${bold(chainId)}:`)
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
          self.info(` `, info)
        }
      } else {
        self.info(`no deployments on ${bold(chainId)}`)
      }
    },

    warnStoreDoesNotExist: (path: string) =>
      self.warn(`deployment store does not exist`),
    warnOverridingStore: (x: string) =>
      self.warn(`overriding store for ${x}`),
    warnNoAgent: (name?: string) =>
      self.warn('no agent. authenticate by exporting FADROMA_MNEMONIC in your shell'),

  }))(this)

  devnet = ((self: Console)=>({

    tryingPort: (port: string|number) =>
      this.log(`trying port`, port),
    creating: ({ chainId, url }: Partial<Devnet>) =>
      this.log(`creating devnet`, chainId, `on`, String(url)),
    loadingState: (chainId1: string, chainId2: string) =>
      self.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`),
    loadingFailed: (path: string) =>
      self.warn(`Failed to load devnet state from ${path}. Deleting it.`),
    loadingRejected: (path: string) =>
      self.log(`${path} does not exist.`),
    createdContainer: (id?: string) =>
      self.log(`created container`, id?.slice(0, 8)),
    startingContainer: (id?: string) =>
      self.log(`starting container`, id?.slice(0, 8)),
    stoppingContainer: (id?: string) =>
      self.log(`stopping container`, id?.slice(0, 8)),
    warnContainerNotFound: (id?: string) =>
      self.warn(`container ${id} not found`),
    noContainerToDelete: (id?: string) =>
      self.log(`no container found`, id?.slice(0, 8)),
    isNowRunning ({ chainId, containerId, port }: Partial<Devnet>) {
      return self
        .info('running on port', bold(String(port)))
        .info(`from container`, bold(containerId?.slice(0,8)))
        .info('manual reset with:').info(`$`,
          `docker kill`, containerId?.slice(0,8), `&&`,
          `docker rm`, containerId?.slice(0,8), `&&`,
          `sudo rm -rf state/${chainId??'fadroma-devnet'}`)
    },
    missingValues ({ chainId, containerId, port }: Partial<Devnet>, path: string) {
      if (!containerId) console.warn(`${path}: no containerId`)
      if (!chainId)     console.warn(`${path}: no chainId`)
      if (!port)        console.warn(`${path}: no port`)
    },
    deleting (path: string) {
      return self.log(`deleting ${path}...`)
    },
    cannotDelete (path: string, error: any) {
      return self.warn(`failed to delete ${path}: ${error.code}`)
    },
    runningCleanupContainer (path: string) {
      return self.log('running cleanup container for', path)
    },
    waitingForCleanupContainer () {
      return self.log('waiting for cleanup container to finish...')
    },
    cleanupContainerDone (path: string) {
      return self.log(`deleted ${path}/* via cleanup container.`)
    },
    failedToDelete (path: string, error: any) {
      return self.warn(`failed to delete ${path}:`, error)
    },
    exitHandlerSet (chainId: string) {
      return self.warn('exit handler already set for', chainId)
    }

  }))(this)

}
