import * as HTTP from 'http'
import { Transform } from 'stream'
import LineTransformStream from 'line-transform-stream'
import {
  Console, bold, resolve, relative, basename, rimraf, spawnSync, existsSync, readFileSync
} from '@hackbg/tools'
import { config } from './Config'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { Endpoint } from './Endpoint'

const console = Console('@fadroma/ops/Build')

/** This builder talks to a remote build server over HTTP. */
export class ManagedBuilder extends Builder {
  Endpoint = Endpoint
  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new this.Endpoint(managerURL)
  }
  /** HTTP endpoint to request builds */
  manager: Endpoint
  /** Perform a managed build. */
  async build (source): Promise<Artifact> {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    // Request a build from the build manager
    const { workspace, crate, ref = 'HEAD' } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

export class RawBuilder extends Builder {
  constructor (public readonly script: string) { super() }
  async build (source: Source): Promise<Artifact> {
    const { ref = 'HEAD', workspace, crate } = source
    if (ref && ref !== 'HEAD') {
      throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
    }
    spawnSync(this.script, [], {
      cwd: workspace,
      stdio: 'inherit',
      env: {
        CRATE: crate,
        REF:   ref
      }
    })
    const location = resolve(workspace, 'artifacts', `${crate}@${ref.replace(/\//g,'_')}.wasm`)
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}
