/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Path, FileFormat, SyncFS, XDG } from '@hackbg/file'
import type { CodeId, ChainId, Address, Uint128 } from '@fadroma/agent'
import { Core, Program } from '@fadroma/agent'
import CLI from '@hackbg/cmds'
import * as OCI from '@fadroma/oci'
import { packageName, packageVersion } from './devnet-base'
import DevnetContainer from './devnet-base'
import * as Platform from './devnet-platform'

const { bold, colors } = Core

/** Identifiers for CLI. */
const platforms = {
  'scrt': Platform.Scrt,
  'okp4': Platform.OKP4,
  'archway': Platform.Archway,
  'osmosis': Platform.Osmosis,
}

/** Commands exposed by Fadroma Devnet. */
export default class DevnetCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``//${packageName} ${packageVersion}`
  }

  async printUsageNoCommand (arg0: this) {
    await this.listDevnets()
    this.log
      .info()
      .info(bold('Available commands:'))
      .info()
    return this.printUsage(arg0)
  }

  listPlatforms = this.command({
    name: 'platforms',
    info: 'show supported platforms',
    args: ''
  }, () => {
    this.log
      .info()
      .info('Supported platforms:')
      .info()
      .info(' ', bold(`PLATFORM`), '', bold(`VERSION`), '', bold(`DESCRIPTION`))
      .info()
    for (let v of Object.keys(Platform.Scrt.versions)) {
      v = v.padEnd(7)
      this.log.info(' ', bold(`scrt      ${v}`), ` Secret Network ${v}`)
    }
    for (let v of Object.keys(Platform.OKP4.versions)) {
      v = v.padEnd(7)
      this.log.info(' ', bold(`okp4      ${v}`), ` OKP4 ${v}`)
    }
    this.log.info()
  })

  listDevnets = this.command({
    name: 'list',
    info: 'list existing devnets',
    args: ''
  }, async () => {
    const engine = new OCI.Connection()
    const devnetsDir = new SyncFS.Directory(
      XDG({ expanded: true, subdir: 'fadroma' }).data.home,
      'devnets'
    )
    devnetsDir.make()
    const devnets = devnetsDir.list()

    if (devnets.length > 0) {

      this.log
        .info()
        .info(`Found ${bold(devnets.length)} devnet(s) in ${bold(devnetsDir.absolute)}:`)
        .info()

      const tags = {
        ok: '[OK]',
        no: '[??]',
      }

      const headers = {
        chainId:   'CHAIN ID / URL',
        port:      'PORT',
        receipt:   'RECEIPT',
        container: 'CONTAINER',
      }

      const longest = {
        name:      'CHAIN ID / URL'.length,
        container: 'IMAGE / CONTAINER'.length
      }

      const receipts = {}

      for (const name of devnets) {
        longest.name = Math.max(longest.name, name.length)
        const receipt = devnetsDir.file(name, 'devnet.json').setFormat(FileFormat.JSON)
        if (receipt.exists()) {
          const { image = '', container = '' } = receipts[name] = receipt.load()
          longest.container = Math.max(longest.container, image.length + 4)
          longest.container = Math.max(longest.container, container.length + 4)
        }
      }

      let hasMissing = false

      for (const name of devnets) {

        let receiptExists   = colors.red('[ ] missing'.padEnd('RECEIPT'.length))
        let port            = colors.red(tags.no)
        let imageExists     = colors.red(tags.no.padEnd(longest.container))
        let containerExists = colors.red(tags.no.padEnd(longest.container))

        const receipt = devnetsDir.file(name, 'devnet.json').setFormat(FileFormat.JSON)

        if (receipt.exists()) {
          receiptExists = colors.green(bold(tags.ok) + ''.padEnd('RECEIPT'.length - tags.ok.length))
          const { image, container, nodePort } = receipt.load() as {
            image:     string
            container: string
            nodePort:  string
          }
          if (image) {
            const padded = image.padEnd(longest.container)
            if (await engine.image(image).exists) {
              imageExists = colors.green(bold(tags.ok) + ' ' + padded)
            } else {
              imageExists = colors.red(bold(tags.no) + ' ' + padded)
              hasMissing = true
            }
          } else {
            hasMissing = true
          }
          if (container) {
            const padded = container.padEnd('CONTAINER'.length)
            if (await engine.container(container).exists) {
              containerExists = colors.green(bold(tags.ok) + ' ' + padded)
            } else {
              containerExists = colors.red(bold(tags.no) + ' ' + padded)
              hasMissing = true
            }
          } else {
            hasMissing = true
          }
          if (nodePort) {
            port = `http://localhost:${nodePort}`.padEnd(tags.no.length)
          }
        }
        this.log
          .info(bold(name), port)
          .info(imageExists)
          .info(containerExists)
          .info()
        //this.log
          //.info(' ', [
            //bold(name.padEnd(longest.name)),
            //receiptExists,
            //imageExists.padEnd(longest.container),
          //].join('  '))
          //.info(' ', [
            //port.padEnd(longest.name),
            //''.padEnd(receiptExists.length),
            //containerExists.padEnd(longest.container)
          //].join('  '))
          //.info()
      }
      if (hasMissing) {
        this.log
          .info('Some devnets depend on missing resources.')
          .info('Invoke the', bold('prune'), 'command if you want to remove all trace of them.')
      }

    } else {

      this.log
        .info()
        .info('No devnets in', bold(devnetsDir.absolute))
        .info('Invoke the', bold('launch'), 'command to run your first devnet!')

    }

  })

  launchDevnet = this.command({
    name: 'launch',
    info: 'create and start a devnet',
    args: 'PLATFORM VERSION [CHAIN-ID]'
  }, async (
    platformName:    keyof typeof platforms,
    platformVersion: string,
    chainId?:        string
  ) => {
    const devnet = await this.createDevnet(platformName, platformVersion, chainId)
    await devnet.started
  })

  createDevnet = this.command({
    name: 'create',
    info: "create a devnet but don't start it yet",
    args: 'PLATFORM VERSION [CHAIN-ID]'
  }, async (
    platformName:    keyof typeof platforms,
    platformVersion: string,
    chainId?:        string
  ) => {
    let Devnet
    const platform = platforms[platformName]
    if (!platform) {
      if (platformName) {
        this.log.error(`Unknown platform "${bold(platform)}".`)
      } else {
        this.log.error(`Specify a platform.`)
      }
      this.listPlatforms()
      process.exit(1)
    }
    const versions = Object.keys(platform.versions)
    if (!platformVersion || !versions.includes(platformVersion)) {
      this.log.error(`Please specify one of the following versions:`)
      for (const v of versions) {
        this.log.info(' ', bold(v))
      }
      process.exit(1)
    }
    const devnet = new Devnet({
      platformName,
      platformVersion,
      onScriptExit: 'remain',
      chainId,
    })
    this.log
      .info(`Chain ID: `, bold(devnet.chainId))
      .info(`Image:    `, bold(devnet.container.image.name))
    await devnet.created
    this.log
      .info(`Container:`, bold(devnet.container.id))
      .info(`Receipt:  `, bold(devnet.stateFile.path))
      .info(
        `Devnet created. Invoke the`,
        `"${bold(`start ${devnet.chainId}`)}"`,
        `command to launch.`
      )
    return devnet
  })

  startDevnet = this.command({
    name: 'start',
    info: 'start a devnet',
    args: 'CHAIN-ID'
  }, async (chainId: string) => {
    const dataDir   = XDG({ expanded: true, subdir: 'fadroma' }).data.home
    const stateDir  = new SyncFS.Directory(dataDir, 'devnets', chainId)
    const stateFile = stateDir.file('devnet.json').setFormat(FileFormat.JSON)
    if (!stateDir.exists()||!stateFile.exists()) {
      if (!stateDir.exists()) {
        this.log.error(bold(stateDir.absolute), `does not exist.`)
      } else {
        this.log.error(bold(stateFile.absolute), `does not exist.`)
      }
      this.log
        .info(
          `Invoke the`,
          `"${bold(`create PLATFORM VERSION ${chainId}`)}"`,
          `command to create this devnet.`
        )
    }
    const {
      platformName,
      platformVersion,
      image,
      container,
      nodePort,
    } = stateFile.load() as {
      platformName:    keyof typeof platforms
      platformVersion: string
      container:       string
      image:           string
      nodePort:        string
    }
    if (!Object.keys(platforms).includes(platformName)) {
      this.log.error(`Receipt contained unsupported platform ${bold(platformName)}.`)
      process.exit(1)
    }
    const devnet = new DevnetContainer({
      platformName,
      platformVersion,
      stateDir,
      stateFile,
      chainId,
      nodePort
    })
    devnet.container.id = container
    devnet.container.image.name = image
    try {
      await devnet.started
      this.log.log('Devnet started.')
    } catch (e) {
      if (e.statusCode === 304) {
        this.log.info('This container is already running')
      } else {
        throw e
      }
    }
  })

  pauseDevnet = this.command({
    name: 'pause',
    info: 'pause a devnet',
    args: 'CHAIN-ID'
  }, (chainId: string) => {
    throw new Error('not implemented')
  })

  exportSnapshot = this.command({
    name: 'snapshot',
    info: 'export snapshot of devnet as container image',
    args: 'CHAIN-ID [IMAGE-TAG]',
  }, (chainId: string, imageTag?: string) => {
    throw new Error('not implemented')
  })

  removeDevnet = this.command({
    name: 'remove',
    info: 'erase a devnet',
    args: 'CHAIN-ID'
  }, (chainId: string) => {
    throw new Error('not implemented')
  })

  pruneDevnets = this.command({
    name: 'prune',
    info: 'delete broken devnets',
    args: ''
  }, async () => {
    const engine = new OCI.Connection()
    const dataDir = XDG({ expanded: true, subdir: 'fadroma' }).data.home
    const devnetsDir = new SyncFS.Directory(dataDir, 'devnets')
    const devnets = devnetsDir.list()
    const missing: Set<string> = new Set()
    for (const devnet of devnets) {
      const devnetFile = devnetsDir.file(devnet, 'devnet.json').setFormat(FileFormat.JSON)
      if (devnetFile.exists()) {
        const { image, container } = devnetFile.load() as {
          image:     string
          container: string
        }
        if (!await engine.image(image).exists) {
          missing.add(devnet)
        }
        if (!await engine.container(container).exists) {
          missing.add(devnet)
        }
      } else {
        missing.add(devnet)
      }
    }
    for (const devnet of missing) {
      this.log.log(`Removing ${bold(devnet)}...`)
      devnetsDir.subdir(devnet).delete()
    }
  })

  printUsageOnly = this.command({
    name: 'usage',
    info: 'print available commands without listing devnets',
    args: ''
  }, () => {
    this.log.info()
    this.printUsage(this)
  })

}

export {
  DevnetContainer
}
