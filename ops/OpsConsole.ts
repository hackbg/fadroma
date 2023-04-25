import { Console as BaseConsole, colors, bold, HEAD } from '@fadroma/agent'
import type { Template, Built } from '@fadroma/agent'
import type { Deployment, DeployStore } from '@fadroma/agent'

import $ from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { CommandsConsoleMixin } from '@hackbg/cmds'

export { bold, colors }

export default class Console extends CommandsConsoleMixin(BaseConsole) {

  constructor (public label = '@fadroma/ops') {
    super()
  }

  build = ((self: Console)=>({

    workspace: (mounted: Path|string, ref: string = HEAD) => self.log(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    ),
    one: ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) => {
      self.log('Building', bold(crate), ...
        (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
    },
    many: (sources: Template<any>[]) => {
      for (const source of sources) self.build.one(source)
    },
    found: (prebuilt: Built & { name?: string }) => {
      self.log(`${prebuilt.name??prebuilt.crate}: found at ${bold($(prebuilt.artifact!).shortPath)}`)
    },
    container: (root: string|Path, revision: string, cratesToBuild: string[]) => {
      root = $(root).shortPath
      const crates = cratesToBuild.map(x=>bold(x)).join(', ')
      self.log(`Started building from ${bold(root)} @ ${bold(revision)}:`, crates)
    },

  }))(this)

  devnet = ((self: Console)=>({

    loadingState: (chainId1: string, chainId2: string) =>
      self.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`),
    loadingFailed: (path: string) =>
      self.warn(`Failed to load devnet state from ${path}. Deleting it.`),
    loadingRejected: (path: string) =>
      self.info(`${path} does not exist.`),
    isNowRunning: (devnet: { port: any, container: { id: string }|null }) => {
      const port = String(devnet.port)
      const id = devnet.container!.id.slice(0,8)
      self.info(`Devnet is running on port ${bold(port)} from container ${bold(id)}.`)
      self.info('Use self command to reset it:')
      self.info(`  docker kill ${id} && sudo rm -rf receipts/fadroma-devnet`)
    }

  }))(this)

  deploy = ((self: Console)=>({

    storeDoesNotExist: (path: string) => {
      self.warn(`Deployment store "${path}" does not exist.`)
    },
    warnOverridingStore: (x: string) => {
      self.warn(`Overriding store for ${x}`)
    },
    warnNoAgent: (name?: string) => {
      return self.warn(
        'No agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.'
      )
    },
    deployment: (deployment: Deployment, name = deployment.name) => {
      name ??= $(deployment.name).shortPath
      super.deployment(deployment, name)
    },
    deploymentList: (chainId: string, deployments: DeployStore) => {
      const list = deployments.list()
      if (list.length > 0) {
        self.info(`Deployments on chain ${bold(chainId)}:`)
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
          if (deployments.active && deployments.active.name === name) {
            info = `${info} ${bold('selected')}`
          }
          self.info(` `, info)
        }
      } else {
        self.info(`No deployments on chain ${bold(chainId)}`)
      }
    },
    creating: (name: string) => {
      self.log('Creating:', bold(name))
    },
    location: (path: string) => {
      self.log('Location:', bold(path))
    },
    activating: (name: string) => {
      self.log('Activate:', bold(name))
    },

  }))(this)

}
