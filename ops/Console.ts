import { Console as BaseConsole, colors, bold, HEAD } from '@fadroma/agent'
import type { Template, Built } from '@fadroma/agent'
import $ from '@hackbg/file'
import type { Path } from '@hackbg/file'
import type { Deployment, DeployStore } from '@fadroma/agent'

export { bold, colors }

export class UploadConsole extends BaseConsole {
  label = 'Upload'
}

export class DevnetConsole extends BaseConsole {
  loadingState = (chainId1: string, chainId2: string) =>
    this.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`)
  loadingFailed = (path: string) =>
    this.warn(`Failed to load devnet state from ${path}. Deleting it.`)
  loadingRejected = (path: string) =>
    this.info(`${path} does not exist.`)
  devnetIsRunning = (devnet: { port: any, container: { id: string }|null }) => {
    const port = String(devnet.port)
    const id = devnet.container!.id.slice(0,8)
    this.info(`Devnet is running on port ${bold(port)} from container ${bold(id)}.`)
    this.info('Use this command to reset it:')
    this.info(`  docker kill ${id} && sudo rm -rf receipts/fadroma-devnet`)
  }
}

export class DeployConsole extends BaseConsole {
  constructor (public label = '@fadroma/ops') {
    super(label)
  }
  warnNoDeployment () {
    return this.warn(
      'No active deployment. Most commands will fail. ' +
      'You can create a deployment using `fadroma-deploy new` ' +
      'or select a deployment using `fadroma-deploy select` ' +
      'among the ones listed by `fadroma-deploy list`.'
    )
  }
  warnNoAgent (name?: string) {
    return this.warn(
      'No agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.'
    )
  }
  warnNoDeployAgent () {
    return this.warn('No deploy agent. Deployments will not be possible.')
  }
  deployment (deployment: Deployment, name = deployment.name) {
    name ??= $(deployment.name).shortPath
    super.deployment(deployment, name)
  }
  deploymentList (chainId: string, deployments: DeployStore) {
    const list = deployments.list()
    if (list.length > 0) {
      this.info(`Deployments on chain ${bold(chainId)}:`)
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
        this.info(` `, info)
      }
    } else {
      this.info(`No deployments on chain ${bold(chainId)}`)
    }
  }
  deployStoreDoesNotExist (path: string) {
    this.warn(`Deployment store "${path}" does not exist.`)
  }
  creatingDeployment (name: string) {
    this.log('Creating:', bold(name))
  }
  locationOfDeployment (path: string) {
    this.log('Location:', bold(path))
  }
  activatingDeployment (name: string) {
    this.log('Activate:', bold(name))
  }
  warnOverridingStore (self: string) {
    this.warn(`Overriding store for ${self}`)
  }
}

export class BuildConsole extends BaseConsole {
  label = 'Build'
  buildingFromCargoToml (file: Path|string) {
    this.log('Building from', bold($(file).shortPath))
  }
  buildingFromBuildScript (file: Path, args: string[] = []) {
    this.log('Build script:', bold(file.shortPath))
    this.log('Build args:  ', bold(args.join(' ') || '(none)'))
  }
  buildingFromWorkspace (mounted: Path|string, ref: string = HEAD) {
    this.log(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }
  buildingOne ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) {
    this.log('Building ', bold(crate), ...
      (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
  }
  buildingMany (sources: Template<any>[]) {
    for (const source of sources) this.buildingOne(source)
  }
  prebuilt (prebuilt: Built) {
    this.log(`${colors.green('Found:')}   `, bold(colors.green($(prebuilt.artifact!).shortPath)))
  }
  usage () {
    this.info(`
      Usage:
        fadroma-build path/to/crate
        fadroma-build path/to/Cargo.toml
        fadroma-build buildConfig.{js|ts}`)
  }
  runningBuildContainer (root: string|Path, revision: string, cratesToBuild: string[]) {
    root = $(root).shortPath
    const crates = cratesToBuild.map(x=>bold(x)).join(', ')
    this.log(`Started building from ${bold(root)} @ ${bold(revision)}:`, crates)
  }
}

export default class Console extends BaseConsole {
  static Build  = BuildConsole
  static Upload = UploadConsole
  static Deploy = DeployConsole
  static Devnet = DevnetConsole
}
