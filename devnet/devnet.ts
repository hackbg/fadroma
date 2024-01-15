/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import $, { JSONFile, JSONDirectory, Directory, XDG } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import type { CodeId, ChainId, Address, Uint128 } from '@fadroma/agent'
import { Core, Program } from '@fadroma/agent'
import CLI from '@hackbg/cmds'
import { OCIConnection, OCIContainer, OCIImage } from '@fadroma/oci'
import { packageName, packageVersion } from './package'
import ScrtContainer from './devnet-scrt'
import OKP4Container from './devnet-okp4'

const { bold, colors } = Core

export {
  ScrtContainer,
  OKP4Container,
}

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

  printUsageOnly = this.command({
    name: 'usage',
    info: 'print available commands without listing devnets',
    args: ''
  }, () => this.printUsage(this))

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
    for (const v of Object.keys(ScrtContainer.v)) {
      this.log.info(' ', bold(`scrt      ${v}    `), ` Secret Network ${v}`)
    }
    for (const v of Object.keys(OKP4Container.v)) {
      this.log.info(' ', bold(`okp4      ${v}    `), ` OKP4 ${v}`)
    }
    this.log.info()
  })

  listDevnets = this.command({
    name: 'list',
    info: 'list existing devnets',
    args: ''
  }, async () => {
    const engine = new OCIConnection()
    const devnetsDir = $(
      XDG({ expanded: true, subdir: 'fadroma' }).data.home, 'devnets'
    ).as(Directory)
    const devnets = devnetsDir.list()

    if (devnets.length > 0) {

      this.log
        .info()
        .info(`Found ${bold(devnets.length)} devnet(s) in ${bold(devnetsDir.path)}:`)
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
        const receipt = $(devnetsDir, name, 'devnet.json').as(JSONFile) as JSONFile<any>
        if (receipt.exists()) {
          const { image = '', container = '' } = receipts[name] = receipt.load()
          longest.container = Math.max(longest.container, image.length + 4)
          longest.container = Math.max(longest.container, container.length + 4)
        }
      }

      let hasMissing = false

      this.log
        .info(' ', bold([
          headers.chainId.padEnd(longest.name),
          //headers.port.padEnd(tags.no.length),
          headers.receipt,
          headers.container.padEnd(longest.container),
        ].join('  ')))
        .info()

      for (const name of devnets) {

        let receiptExists   = colors.red('[ ] missing'.padEnd('RECEIPT'.length))
        let port            = colors.red(tags.no)
        let imageExists     = colors.red(tags.no.padEnd(longest.container))
        let containerExists = colors.red(tags.no.padEnd(longest.container))

        const receipt = $(
          devnetsDir, name, 'devnet.json'
        ).as(JSONFile) as JSONFile<any>

        if (receipt.exists()) {
          receiptExists = colors.green(bold(tags.ok) + ''.padEnd('RECEIPT'.length - tags.ok.length))
          const { image, container, nodePort } = receipt.load()
          if (image) {
            if (await engine.image(image).exists) {
              imageExists = colors.green(bold(tags.ok) + ' ' + image.padEnd(longest.container))
            } else {
              imageExists = colors.red(bold(tags.no) + ' ' + image.padEnd(longest.container))
              hasMissing = true
            }
          } else {
            hasMissing = true
          }
          if (container) {
            if (await engine.container(container).exists) {
              containerExists = colors.green(bold(tags.ok) + ' ' + container.padEnd('CONTAINER'.length))
            } else {
              containerExists = colors.red(bold(tags.no) + ' ' + container.padEnd('CONTAINER'.length))
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
          .info(' ', [
            bold(name.padEnd(longest.name)),
            receiptExists,
            imageExists.padEnd(longest.container),
          ].join('  '))
          .info(' ', [
            port.padEnd(longest.name),
            ''.padEnd(receiptExists.length),
            containerExists.padEnd(longest.container)
          ].join('  '))
          .info()
      }
      if (hasMissing) {
        this.log
          .info('Some devnets depend on missing resources.')
          .info('Invoke the', bold('prune'), 'command if you want to remove all trace of them.')
      }

    } else {

      this.log
        .info()
        .info('No devnets in', bold(devnetsDir.path))
        .info('Invoke the', bold('launch'), 'command to create and start your first devnet!')

    }

  })

  launchDevnet = this.command({
    name: 'launch',
    info: 'create and start a devnet',
    args: 'PLATFORM VERSION [CHAIN-ID]'
  }, async (platform: 'scrt'|'okp4', version: string, chainId?: string) => {
    await (await this.createDevnet(platform, version, chainId)).started
  })

  createDevnet = this.command({
    name: 'create',
    info: 'create a devnet',
    args: 'PLATFORM VERSION [CHAIN-ID]'
  }, async (platform: 'scrt'|'okp4', version: string, chainId?: string) => {
    let Devnet
    switch (platform) {
      case 'scrt':
        Devnet = ScrtContainer
        break
      case 'okp4':
        Devnet = OKP4Container
        break
      default:
        this.log.error(`Unknown platform "${bold(platform)}".`)
        this.listPlatforms()
        process.exit(1)
    }
    if (!version || !Object.keys(Devnet.v).includes(version)) {
      this.log.error(`Please specify one of the following versions:`)
      for (const v of Object.keys(OKP4Container.v)) {
        this.log.info(' ', bold(v))
      }
    }
    const devnet = new Devnet({ version, chainId })
    this.log
      .log()
      .log('Creating devnet:')
      .log(`  Chain ID: `, bold(devnet.chainId))
      .log(`  Image:    `, bold(devnet.container.image.name))
    await devnet.created
    this.log
      .log(`  Container:`, bold(devnet.container.id))
      .log(`  Receipt:  `, bold(devnet.stateFile.path))
      .log()
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
    const stateDir = $(
      XDG({ expanded: true, subdir: 'fadroma' }).data.home, 'devnets', chainId
    )
    const stateFile = $(
      stateDir, 'devnet.json'
    ).as(JSONFile) as JSONFile<{
      platformName:    string
      platformVersion: string
      container:       string
      image:           string
      nodePort:        string
    }>
    if (!stateDir.exists||!stateFile.exists) {
      if (!stateDir.exists) {
        this.log
          .error(bold(stateDir.path), `does not exist.`)
      } else {
        this.log
          .error(bold(stateFile.path), `does not exist.`)
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
    } = stateFile.load()
    let Devnet
    switch (platformName) {
      case 'scrt':
        Devnet = ScrtContainer
        break
      case 'okp4':
        Devnet = OKP4Container
        break
      default:
        this.log.error(`Receipt contained unsupported platform ${bold(platformName)}.`)
        process.exit(1)
    }
    const devnet = new Devnet({
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

  exportDevnet = this.command({
    name: 'export',
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
    const engine = new OCIConnection()
    const devnetsDir = $(
      XDG({ expanded: true, subdir: 'fadroma' }).data.home, 'devnets'
    ).as(Directory)
    const devnets = devnetsDir.list()
    const missing: Set<string> = new Set()
    for (const devnet of devnets) {
      const devnetFile    = $(devnetsDir, devnet, 'devnet.json').as(JSONFile) as JSONFile<any>
      if (devnetFile.exists()) {
        const { image, container } = devnetFile.load()
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
      $(devnetsDir, devnet).delete()
    }
  })

}
