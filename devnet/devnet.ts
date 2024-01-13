/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import $, { JSONFile, JSONDirectory, Directory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import type { CodeId, ChainId, Address, Uint128, CompiledCode } from '@fadroma/agent'
import { bold } from '@fadroma/agent'
import CLI from '@hackbg/cmds'
import { packageName, packageVersion } from './package'
import ScrtContainer from './devnet-scrt'
import OKP4Container from './devnet-okp4'

export {
  ScrtContainer,
  OKP4Container,
}

/** Identifiers of supported platforms. */
export type Platform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`

/** Identifiers of supported API endpoints.
  * These are different APIs exposed by a node at different ports. 
  * One of these is used by default - can be a different one
  * depending on platform version. */
export type APIMode =
  |'http'
  |'rpc'
  |'grpc'
  |'grpcWeb'

export default class FadromaDevnetCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``//${packageName} ${packageVersion}`
  }

  listPlatforms = this.command('platforms', 'list supported platforms', () => {
    this.log
      .info('Supported platforms:')
      .info()
      .info(' ', bold(`PLATFORM`), '', bold(`VERSION`), '', `Description`)
      .info()
    for (const v of Object.keys(ScrtContainer.v)) {
      this.log.info(' ', bold(`scrt      ${v}    `), ` Secret Network ${v}`)
    }
    for (const v of Object.keys(OKP4Container.v)) {
      this.log.info(' ', bold(`okp4      ${v}    `), ` OKP4 ${v}`)
    }
    this.log.info()
  })

  listDevnets = this.command2({
    name: 'list',
    info: 'list existing devnets',
    args: ''
  }, () => {
  })

  createDevnet = this.command2({
    name: 'create',
    info: 'create a devnet (args: PLATFORM VERSION [CHAIN-ID])',
    args: 'PLATFORM VERSION [CHAIN-ID]'
  }, async (platform: 'scrt'|'okp4', version: string, chainId?: string) => {
    let Platform
    switch (platform) {
      case 'scrt':
        Platform = ScrtContainer
        break
      case 'okp4':
        Platform = OKP4Container
        break
      default:
        this.log.error(`Unknown platform "${bold(platform)}".`)
        this.listPlatforms()
        process.exit(1)
    }
    if (!version || !Object.keys(Platform.v).includes(version)) {
      this.log.error(`Please specify one of the following versions:`)
      for (const v of Object.keys(OKP4Container.v)) {
        this.log.info(' ', bold(v))
      }
    }
    const devnet = new Platform({ version })
    this.log
      .log('Creating devnet...')
      .log(`Chain ID: `, bold(devnet.chainId))
      .log(`Image:    `, bold(devnet.container.image.name))
    await devnet.created
    this.log
      .log(`Container:`, bold(devnet.container.id))
      .log(`Receipt:  `, bold(devnet.stateFile.path))
    return devnet
  })

  startDevnet = this.command2({
    name: 'start',
    info: 'start a devnet',
    args: 'CHAIN-ID'
  }, (chainId: string) => {
  })

  pauseDevnet = this.command2({
    name: 'pause',
    info: 'pause a devnet',
    args: 'CHAIN-ID'
  }, (chainId: string) => {
  })

  exportDevnet = this.command2({
    name: 'export',
    info: 'export a snapshot of a devnet as a container image',
    args: 'CHAIN-ID [IMAGE-TAG]',
  }, (chainId: string, imageTag?: string) => {
  })

  removeDevnet = this.command2({
    name: 'remove',
    info: 'erase a devnet',
    args: 'CHAIN-ID'
  }, (chainId: string) => {
  })

}
