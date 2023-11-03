/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as Devnets from './devnets'
import { Config, Error, ConnectConfig, UploadStore, DeployStore } from '@fadroma/connect'
import type { Environment, Class, DeploymentClass } from '@fadroma/connect'
import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
export const thisPackage = dirname(dirname(fileURLToPath(
  //@ts-ignore
  import.meta.url
)))

/** Version of Fadroma in use. */
export const { version } = $(thisPackage, 'package.json')
  .as(JSONFile)
  .load() as { version: string }

/** Complete Fadroma configuration. */
class FadromaConfig extends Config {
  /** License token. */
  license?: string = this.getString('FADROMA_LICENSE', ()=>undefined)
  /** The topmost directory visible to Fadroma.
    * Usually the root of NPM package and Cargo workspace. */
  root: string = this.getString('FADROMA_ROOT', ()=>$(process.cwd()).path)
  /** Project file. Defaults to `node_modules/fadroma/index.ts`, which just runs the Fadroma CLI
    * and can create a project. Projects are expected to set this var to their own root file,
    * which does `export default class MyProject extends Fadroma.Project { ... }` and points to
    * the Deployment class. */
  project: string = $(this.root, this.getString('FADROMA_PROJECT', ()=>{
    return $(thisPackage, 'fadroma.ts').path
  })).path
  /** Connect options */
  connect: ConnectConfig
  /** Devnet options. */
  devnet:  Devnets.Config

  constructor (
    options: Partial<Config> & Partial<{
      connect: Partial<ConnectConfig>,
      devnet:  Partial<Devnets.Config>
    }> = {},
    environment?: Environment
  ) {
    super(environment)
    const { connect, devnet, ...rest } = options
    this.override(rest)
    this.connect = new ConnectConfig(connect, environment)
    this.devnet = new Devnets.Config(devnet, environment)
  }
}

export { FadromaConfig as Config }
